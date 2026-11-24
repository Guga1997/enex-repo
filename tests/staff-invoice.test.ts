/**
 * ადმინიდან გამოწერილი ინვოისი (გაყიდვები): შეკვეთა საიტის ფასით, საბანკო გადარიცხვით,
 * ნაშთის დაკავებით და ინვოისის ნომრით. რეალურ ბაზაზე (dev SQLite) — ბოლოს ყველაფერი იშლება.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { createStaffInvoice } from "../src/lib/staff-order";
import { cancelOrder } from "../src/lib/orders";
import { buildInvoiceHtml } from "../src/lib/invoice";
import { canOpen } from "../src/lib/workflow";

const STAFF = { name: "ტესტი გაყიდვები" };
const made: string[] = [];
const base = { customerName: "ტესტ მყიდველი", customerPhone: "599000000", deliveryMethod: "PICKUP" as const };

after(async () => {
  for (const id of made) {
    await cancelOrder(id).catch(() => {});
    await db.order.delete({ where: { id } }).catch(() => {});
  }
  await db.$disconnect();
});

const inStock = () =>
  db.product.findFirst({
    where: { isActive: true, price: { gt: 0 }, stockStatus: "IN_STOCK", stockQty: { gte: 3 }, reservedQty: 0, minQty: 1, qtyStep: 1, oldPrice: null },
    select: { id: true, sku: true, price: true, reservedQty: true },
  });

test("ინვოისის გამოწერა: საიტის ფასი, გადარიცხვა, ნომერი, ნაშთი დაკავებულია", async () => {
  const p = await inStock();
  assert.ok(p, "ტესტს მარაგში მყოფი პროდუქტი სჭირდება");
  const r = await createStaffInvoice({ ...base, companyName: "შპს ტესტი", customerId: "400000000", items: [{ productId: p.id, qty: 2 }] }, STAFF);
  assert.ok(r.ok, r.ok ? "" : r.error);
  made.push(r.orderId);

  const order = await db.order.findUniqueOrThrow({ where: { id: r.orderId }, include: { items: true } });
  assert.equal(order.paymentMethod, "BANK_TRANSFER");
  assert.equal(order.userId, null);
  assert.equal(order.items[0].price, p.price, "ფასი საიტისაა — თანამშრომელი ვერ ცვლის");
  assert.equal(order.items[0].reservedQty, 2);
  assert.equal(order.total, Number((p.price * 2).toFixed(2)), "გატანაზე მიწოდების საფასური არ ემატება");
  assert.ok(order.invoiceNumber, "ინვოისის ნომერი მინიჭებულია");
  assert.equal(order.invoiceSentAt, null, "ელფოსტის გარეშე არაფერი იგზავნება");
  assert.match(order.comment ?? "", /ტესტი გაყიდვები/, "ჩანს, ვინ გამოწერა");
  const sheet = buildInvoiceHtml(order);
  assert.ok(sheet.includes("შპს ტესტი") && sheet.includes(order.invoiceNumber!));
  assert.ok(!sheet.includes("ტესტი გაყიდვები"), "შიდა შენიშვნა მყიდველის ინვოისზე არ იბეჭდება");
  assert.ok(order.reservedUntil && order.reservedUntil.getTime() > Date.now());
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).reservedQty, 2);
});

test("მიტანა: ქალაქი სავალდებულოა და საფასური ქალაქით ითვლება", async () => {
  const p = await db.product.findFirst({
    where: { isActive: true, price: { gt: 0, lt: 150 }, stockStatus: "IN_STOCK", stockQty: { gte: 2 }, reservedQty: 0, minQty: 1, qtyStep: 1, oldPrice: null },
    select: { id: true, price: true },
  });
  if (!p) return; // 150 ₾-მდე მარაგში მყოფი პროდუქტი არ არის
  const items = [{ productId: p.id, qty: 1 }];
  const noCity = await createStaffInvoice({ ...base, deliveryMethod: "COURIER", deliveryAddress: "ქუჩა 1", items }, STAFF);
  assert.ok(!noCity.ok);
  const r = await createStaffInvoice({ ...base, deliveryMethod: "COURIER", deliveryCity: "ბათუმი", deliveryAddress: "ქუჩა 1", items }, STAFF);
  assert.ok(r.ok, r.ok ? "" : r.error);
  made.push(r.orderId);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: r.orderId } })).deliveryFee, 40);
});

test("უარი: ცარიელი სია, ნაშთზე მეტი, უფასო პროდუქტი, ელფოსტის გარეშე გაგზავნა", async () => {
  assert.ok(!(await createStaffInvoice({ ...base, items: [] }, STAFF)).ok);
  const p = await inStock();
  assert.ok(p);
  const tooMany = await createStaffInvoice({ ...base, items: [{ productId: p.id, qty: 99999 }] }, STAFF);
  assert.ok(!tooMany.ok && /ხელმისაწვდომია/.test(tooMany.error));
  const noMail = await createStaffInvoice({ ...base, sendEmail: true, items: [{ productId: p.id, qty: 1 }] }, STAFF);
  assert.ok(!noMail.ok);
  const free = await db.product.findFirst({ where: { isActive: true, price: 0 }, select: { id: true } });
  if (free) assert.ok(!(await createStaffInvoice({ ...base, items: [{ productId: free.id, qty: 1 }] }, STAFF)).ok);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: p.id } })).reservedQty, 0, "უარზე ნაშთი არ იკავება");
});

test("გვერდს ხედავს გაყიდვები და ადმინი", () => {
  assert.ok(canOpen("SALES", "/admin/invoices"));
  assert.ok(canOpen("ADMIN", "/admin/invoices"));
  for (const role of ["PURCHASING", "ACCOUNTING", "DELIVERY"]) assert.ok(!canOpen(role, "/admin/invoices"), role);
});
