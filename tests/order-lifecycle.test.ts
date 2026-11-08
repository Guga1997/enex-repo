/**
 * შეკვეთის ციკლი ნამდვილ (dev SQLite) ბაზაზე: რეზერვაცია, ორმაგი გადახდა, გაუქმება,
 * ვადის შემდეგ მოსული გადახდა, ნომრების მრიცხველი. ყველა ჩანაწერი TESTLC- პრეფიქსით
 * იქმნება და ბოლოს იშლება.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { cancelOrder, markOrderFailed, markOrderPaid, reserveStock } from "../src/lib/orders";
import { nextNumber, parseTail } from "../src/lib/sequence";

const P = "TESTLC-";
let categoryId = "";

async function cleanup() {
  await db.order.deleteMany({ where: { number: { startsWith: P } } });
  await db.product.deleteMany({ where: { sku: { startsWith: P } } });
  await db.counter.deleteMany({ where: { key: { startsWith: "TLC" } } });
}

before(async () => {
  await cleanup();
  categoryId = (await db.category.findFirstOrThrow({ select: { id: true } })).id;
});
after(async () => {
  await cleanup();
  await db.$disconnect();
});

async function product(sku: string, stockQty: number, status = "IN_STOCK") {
  return db.product.create({
    // გამორთული — კატალოგის ტესტები პარალელურად ითვლის აქტიურ პროდუქტებს
    data: { sku: P + sku, slug: (P + sku).toLowerCase(), nameKa: "ტესტი " + sku, price: 100, stockQty, stockStatus: status, categoryId, isActive: false },
  });
}

/** შეკვეთა ისე, როგორც /api/orders ქმნის: მარაგში მყოფი ხაზი იკავებს, დანარჩენი — არა */
async function order(n: string, lines: { productId: string; qty: number; inStock: boolean }[], minutes = 20) {
  return db.$transaction(async (tx) => {
    const reserved: number[] = [];
    for (const l of lines) {
      if (!l.inStock) { reserved.push(0); continue; }
      assert.ok(await reserveStock(tx, l.productId, l.qty), "reserve " + n);
      reserved.push(l.qty);
    }
    return tx.order.create({
      data: {
        number: P + n, customerName: "T", customerPhone: "5", customerEmail: "t@t.ge",
        subtotal: 100, total: 100, paymentMethod: "BOG",
        reservedUntil: new Date(Date.now() + minutes * 60_000),
        items: { create: lines.map((l, i) => ({ productId: l.productId, sku: "x", name: "x", price: 100, qty: l.qty, reservedQty: reserved[i] })) },
      },
    });
  });
}

const stock = (id: string) => db.product.findUniqueOrThrow({ where: { id }, select: { stockQty: true, reservedQty: true } });

test("ბოლო ცალს მეორე ვერ დაიკავებს", async () => {
  const p = await product("last", 1);
  const ok1 = await db.$transaction((tx) => reserveStock(tx, p.id, 1));
  const ok2 = await db.$transaction((tx) => reserveStock(tx, p.id, 1));
  assert.equal(ok1, true);
  assert.equal(ok2, false);
  assert.deepEqual(await stock(p.id), { stockQty: 1, reservedQty: 1 });
});

test("გადახდა ორჯერ ერთდროულად — ნაშთი ერთხელ ჩამოიწერება", async () => {
  const p = await product("pay2", 5);
  const o = await order("pay2", [{ productId: p.id, qty: 2, inStock: true }]);
  await Promise.all([markOrderPaid(o.id, undefined, { notify: false }), markOrderPaid(o.id, undefined, { notify: false })]);
  await markOrderPaid(o.id, undefined, { notify: false }); // callback-ის გამეორება
  assert.deepEqual(await stock(p.id), { stockQty: 3, reservedQty: 0 });
  const after = await db.order.findUniqueOrThrow({ where: { id: o.id } });
  assert.equal(after.paymentStatus, "PAID");
});

test("წინასწარი შეკვეთის გაუქმება სხვის რეზერვაციას არ ხსნის", async () => {
  const p = await product("pre", 3);
  const holder = await order("holder", [{ productId: p.id, qty: 3, inStock: true }]);
  const pre = await order("pre", [{ productId: p.id, qty: 5, inStock: false }]);
  await cancelOrder(pre.id, "EXPIRED");
  assert.deepEqual(await stock(p.id), { stockQty: 3, reservedQty: 3 });
  await cancelOrder(holder.id);
  assert.deepEqual(await stock(p.id), { stockQty: 3, reservedQty: 0 });
});

test("ორჯერ გაუქმება/ჩავარდნა — რეზერვაცია ერთხელ იხსნება", async () => {
  const p = await product("twice", 4);
  const a = await order("twiceA", [{ productId: p.id, qty: 2, inStock: true }]);
  const b = await order("twiceB", [{ productId: p.id, qty: 1, inStock: true }]);
  await markOrderFailed(a.id);
  await markOrderFailed(a.id);
  await cancelOrder(a.id);
  assert.deepEqual(await stock(p.id), { stockQty: 4, reservedQty: 1 }); // b-ს ჯავშანი ხელუხლებელია
  const failed = await db.order.findUniqueOrThrow({ where: { id: a.id } });
  assert.equal(failed.paymentStatus, "FAILED");
  assert.equal(failed.status, "CANCELLED");
  await cancelOrder(b.id);
});

test("ვადის შემდეგ მოსული გადახდა — სხვისი ჯავშანი არ იკარგება, ნაშთი ჩამოიწერება", async () => {
  const p = await product("late", 2);
  const o = await order("late", [{ productId: p.id, qty: 1, inStock: true }]);
  await cancelOrder(o.id, "EXPIRED");
  const other = await order("other", [{ productId: p.id, qty: 1, inStock: true }]);
  await markOrderPaid(o.id, undefined, { notify: false });
  assert.deepEqual(await stock(p.id), { stockQty: 1, reservedQty: 1 });
  const paid = await db.order.findUniqueOrThrow({ where: { id: o.id } });
  assert.equal(paid.paymentStatus, "PAID");
  // გადახდილს ვადის ტაიმერი ვეღარ გააუქმებს
  await cancelOrder(o.id, "EXPIRED");
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status, "PAID");
  await cancelOrder(other.id);
});

test("ჩემი მარაგი პირველი იხარჯება", async () => {
  const p = await product("own", 0);
  const sup = await db.supplier.findFirst();
  if (!sup) return; // dev ბაზაში მიმწოდებელი არ არის — სხვა ტესტები ფარავს
  await db.productSupply.create({ data: { productId: p.id, supplierId: sup.id, supplierSku: P + "own", qty: 5 } });
  await db.product.update({ where: { id: p.id }, data: { stockAdjust: 2, stockQty: 7 } });
  const o = await order("own", [{ productId: p.id, qty: 3, inStock: true }]);
  await markOrderPaid(o.id, undefined, { notify: false });
  const after = await db.product.findUniqueOrThrow({ where: { id: p.id }, include: { supplies: true } });
  assert.equal(after.stockAdjust, 0);
  assert.equal(after.supplies[0].qty, 4);
  assert.equal(after.stockQty, 4);
});

test("ნომრების მრიცხველი: არსებული მაქსიმუმიდან, გამეორების გარეშე", async () => {
  const year = new Date().getFullYear();
  const nums: string[] = [];
  for (let i = 0; i < 5; i++) {
    nums.push(await db.$transaction((tx) => nextNumber(tx, "TLC", async () => `TLC-${year}-00041`)));
  }
  const tails = nums.map((n) => parseTail(n, `TLC-${year}`));
  assert.deepEqual(tails, [42, 43, 44, 45, 46]);
  assert.equal(parseTail("ORD-2025-00007", "ORD-2026"), 0);
  assert.equal(parseTail(null, "ORD-2026"), 0);
});
