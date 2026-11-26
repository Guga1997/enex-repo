/**
 * მაღაზიის გაყიდვა (ადმინი → მაღაზიის გაყიდვები): მომზადება, „გაიყიდა“ და გაუქმება.
 * რეალურ ბაზაზე (dev SQLite) — ბოლოს ნაშთი და ჩანაწერები უკან ბრუნდება.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { cancelStoreSale, createStaffOrder, markStoreSold } from "../src/lib/staff-order";
import { cancelOrder } from "../src/lib/orders";
import { canOpen } from "../src/lib/workflow";

const STAFF = { name: "ტესტი გაყიდვები" };
const made: string[] = [];
const restore: { id: string; stockQty: number; stockAdjust: number; reservedQty: number; stockStatus: string; supplies: { id: string; qty: number }[] }[] = [];
const base = { kind: "STORE" as const, customerName: "გიორგი ტესტაძე", deliveryMethod: "PICKUP" as const };

after(async () => {
  for (const id of made) {
    await cancelOrder(id).catch(() => {});
    await db.order.delete({ where: { id } }).catch(() => {});
  }
  // გაყიდვამ ნაშთი ჩამოწერა — ტესტის შემდეგ ისევ ისე უნდა იყოს
  for (const p of restore) {
    await db.product.update({ where: { id: p.id }, data: { stockQty: p.stockQty, stockAdjust: p.stockAdjust, reservedQty: p.reservedQty, stockStatus: p.stockStatus } });
    for (const s of p.supplies) await db.productSupply.update({ where: { id: s.id }, data: { qty: s.qty } });
  }
  await db.$disconnect();
});

async function product() {
  const p = await db.product.findFirst({
    where: { isActive: true, price: { gt: 0 }, stockStatus: "IN_STOCK", stockQty: { gte: 4 }, reservedQty: 0, minQty: 1, qtyStep: 1, oldPrice: null },
    select: { id: true, price: true, stockQty: true, stockAdjust: true, reservedQty: true, stockStatus: true, supplies: { select: { id: true, qty: true } } },
  });
  assert.ok(p, "ტესტს მარაგში მყოფი პროდუქტი სჭირდება");
  if (!restore.some((r) => r.id === p.id)) restore.push(p);
  return p;
}

test("მომზადება: საიტის ნივთი + სხვა ნივთი; ნაშთი იკავება, მაგრამ ჯერ არ აკლდება", async () => {
  const p = await product();
  const r = await createStaffOrder(
    { ...base, comment: "დარეკა, ხვალ მოვა", items: [{ productId: p.id, qty: 2 }], customItems: [{ name: "მონტაჟის მომსახურება", price: 50, qty: 1 }] },
    STAFF
  );
  assert.ok(r.ok, r.ok ? "" : r.error);
  made.push(r.orderId);
  const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId }, include: { items: true } });
  assert.equal(o.channel, "STORE");
  assert.equal(o.staffName, "ტესტი გაყიდვები");
  assert.equal(o.paymentMethod, "POS");
  assert.equal(o.status, "PENDING");
  assert.equal(o.invoiceNumber, null, "მაღაზიის გაყიდვას ინვოისი არ ეწერება");
  assert.equal(o.customerPhone, "", "ტელეფონი არასავალდებულოა");
  assert.equal(o.total, Number((p.price * 2 + 50).toFixed(2)));
  const custom = o.items.find((i) => !i.productId)!;
  assert.equal(custom.name, "მონტაჟის მომსახურება");
  assert.equal(custom.reservedQty, 0);
  const now = await db.product.findUniqueOrThrow({ where: { id: p.id } });
  assert.equal(now.reservedQty, 2, "დაკავებულია");
  assert.equal(now.stockQty, p.stockQty, "ჯერ არ ჩამოწერილა");
});

test("„გაიყიდა“: ნაშთი აკლდება ისე, როგორც ონლაინ გაყიდვაზე; მეორე დაჭერა არაფერს ცვლის", async () => {
  const p = await product();
  const before = await db.product.findUniqueOrThrow({ where: { id: p.id } });
  const r = await createStaffOrder({ ...base, items: [{ productId: p.id, qty: 1 }] }, STAFF);
  assert.ok(r.ok, r.ok ? "" : r.error);
  made.push(r.orderId);

  assert.deepEqual(await markStoreSold(r.orderId), { ok: true });
  const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
  assert.equal(o.paymentStatus, "PAID");
  assert.equal(o.status, "DELIVERED", "მყიდველმა ნივთი იქვე წაიღო — დასრულებულია");
  const sold = await db.product.findUniqueOrThrow({ where: { id: p.id } });
  assert.equal(sold.stockQty, before.stockQty - 1);
  assert.equal(sold.reservedQty, before.reservedQty, "ამ გაყიდვის ჯავშანი მოიხსნა");

  assert.deepEqual(await markStoreSold(r.orderId), { ok: true });
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stockQty, before.stockQty - 1, "ორჯერ არ აკლდება");
  const cancel = await cancelStoreSale(r.orderId);
  assert.ok(!cancel.ok, "გაყიდული აქედან არ უქმდება");
});

test("გაუქმება ჯავშანს ხსნის; გაუქმებული ვეღარ „გაიყიდება“", async () => {
  const p = await product();
  const before = await db.product.findUniqueOrThrow({ where: { id: p.id } });
  const r = await createStaffOrder({ ...base, items: [{ productId: p.id, qty: 1 }] }, STAFF);
  assert.ok(r.ok, r.ok ? "" : r.error);
  made.push(r.orderId);
  assert.deepEqual(await cancelStoreSale(r.orderId), { ok: true });
  const now = await db.product.findUniqueOrThrow({ where: { id: p.id } });
  assert.equal(now.reservedQty, before.reservedQty);
  assert.equal(now.stockQty, before.stockQty);
  const again = await markStoreSold(r.orderId);
  assert.ok(!again.ok && /თავიდან/.test(again.error));
});

test("მხოლოდ სხვა ნივთით; ცარიელი სია და ინვოისში სხვა ნივთი — უარი; საიტის შეკვეთას „გაიყიდა“ არ ეხება", async () => {
  const only = await createStaffOrder({ ...base, companyName: "შპს ტესტი", customItems: [{ name: "კაბელის გაყვანა", price: 120.5, qty: 2 }] }, STAFF);
  assert.ok(only.ok, only.ok ? "" : only.error);
  made.push(only.orderId);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: only.orderId } })).total, 241);
  assert.deepEqual(await markStoreSold(only.orderId), { ok: true }, "ნაშთის გარეშე ნივთიც დასტურდება");

  assert.ok(!(await createStaffOrder({ ...base }, STAFF)).ok);
  const inv = await createStaffOrder({ ...base, kind: "INVOICE", customerPhone: "599000000", customItems: [{ name: "X ნივთი", price: 1, qty: 1 }] }, STAFF);
  assert.ok(!inv.ok);

  const web = await db.order.findFirst({ where: { channel: "WEB" }, select: { id: true } });
  if (web) assert.ok(!(await markStoreSold(web.id)).ok);
});

test("გვერდს ხედავს გაყიდვები და ადმინი", () => {
  assert.ok(canOpen("SALES", "/admin/sales"));
  assert.ok(canOpen("SALES", "/admin/sales/new"));
  assert.ok(canOpen("ADMIN", "/admin/sales"));
  for (const role of ["PURCHASING", "ACCOUNTING", "DELIVERY"]) assert.ok(!canOpen(role, "/admin/sales"), role);
});
