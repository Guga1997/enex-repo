/** რეზერვაციის ციკლი: დაკავება → ჩავარდნა/გადახდა/ვადა → ნაშთი სწორადაა? */
import { PrismaClient } from "@prisma/client";
import { markOrderFailed, markOrderPaid, releaseExpiredReservations, cancelOrder } from "../src/lib/orders";
import { availableQty } from "../src/lib/stock";

const db = new PrismaClient();

async function makeOrder(productId: string, qty: number, reservedUntil: Date) {
  await db.product.update({ where: { id: productId }, data: { reservedQty: { increment: qty } } });
  return db.order.create({
    data: {
      number: "TEST-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      customerName: "ტესტი", customerPhone: "555000000", customerEmail: "t@t.ge",
      subtotal: 1, total: 1, paymentMethod: "BOG", reservedUntil,
      items: { create: [{ productId, sku: "x", name: "x", price: 1, qty }] },
    },
  });
}

const show = async (id: string, label: string) => {
  const p = await db.product.findUnique({ where: { id } });
  console.log(`  ${label.padEnd(28)} ნაშთი ${p!.stockQty}  დაკავებული ${p!.reservedQty}  ხელმისაწვდომი ${availableQty(p!)}`);
};

async function main() {
  const p = await db.product.findFirst({ where: { stockQty: { gte: 5 }, stockStatus: "IN_STOCK" } });
  if (!p) return console.log("ნაშთიანი პროდუქტი ვერ მოიძებნა");
  await db.product.update({ where: { id: p.id }, data: { reservedQty: 0 } });
  const start = p.stockQty;
  console.log(`პროდუქტი #${p.sku}, ნაშთი ${start}\n`);

  // 1. ჩავარდნა → უბრუნდება
  const o1 = await makeOrder(p.id, 2, new Date(Date.now() + 15 * 60_000));
  await show(p.id, "შეკვეთა 2 ცალზე:");
  await markOrderFailed(o1.id);
  await show(p.id, "გადახდა ჩავარდა:");

  // 2. გადახდა → ჩამოიწერება
  const o2 = await makeOrder(p.id, 2, new Date(Date.now() + 15 * 60_000));
  await markOrderPaid(o2.id);
  await show(p.id, "გადახდა დადასტურდა:");
  await markOrderPaid(o2.id);
  await show(p.id, "callback მეორედ (იდემპ.):");

  // 3. ვადა გავიდა → უბრუნდება
  const o3 = await makeOrder(p.id, 1, new Date(Date.now() - 60_000));
  await show(p.id, "ვადაგასული შეკვეთა:");
  const n = await releaseExpiredReservations();
  await show(p.id, `sweep (${n} გაუქმდა):`);
  const o3s = await db.order.findUnique({ where: { id: o3.id } });
  console.log(`  სტატუსი: ${o3s!.status}`);

  // 4. ადმინის გაუქმება
  const o4 = await makeOrder(p.id, 1, new Date(Date.now() + 15 * 60_000));
  await cancelOrder(o4.id);
  await show(p.id, "ადმინმა გააუქმა:");

  const end = await db.product.findUnique({ where: { id: p.id } });
  const ok = end!.stockQty === start - 2 && end!.reservedQty === 0;
  console.log(`\n${ok ? "✓" : "✗"} მოსალოდნელი: ნაშთი ${start - 2}, დაკავებული 0`);

  await db.order.deleteMany({ where: { number: { startsWith: "TEST-" } } });
  await db.product.update({ where: { id: p.id }, data: { stockQty: start, reservedQty: 0 } });
}

main().finally(() => db.$disconnect());
