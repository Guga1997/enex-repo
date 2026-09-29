/**
 * ფასწარმოქმნა: თვითღირებულება ყოველთვის იმ მიმწოდებლისა უნდა იყოს,
 * რომლითაც ფასი დაითვალა (ყველაზე იაფი). სხვაგვარად კატალოგში ჩნდება
 * პროდუქტი, რომელიც „თვითღირებულებაზე იაფად იყიდება“.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { repriceProduct } from "../src/lib/suppliers/pricing";

const SKU = "TEST-PRICING-1";
let productId = "";
const supplierIds: string[] = [];

after(async () => {
  if (productId) await db.product.delete({ where: { id: productId } }).catch(() => {});
  for (const id of supplierIds) await db.supplier.delete({ where: { id } }).catch(() => {});
  await db.$disconnect();
});

test("ორი მიმწოდებლიდან იაფი იმარჯვებს და cost მასზე ჯდება", async () => {
  const category = await db.category.findFirst({ where: { parentId: { not: null } }, select: { id: true } });
  assert.ok(category, "კატეგორია ვერ მოიძებნა");

  const mk = (slug: string) =>
    db.supplier.create({
      data: { slug, name: slug, adapter: "GENERIC_REST", retailBase: "COST", markupRetail: 30, markupDealer: 15 },
    });
  const cheap = await mk("test-cheap");
  const pricey = await mk("test-pricey");
  supplierIds.push(cheap.id, pricey.id);

  const product = await db.product.create({
    data: { sku: SKU, slug: SKU.toLowerCase(), nameKa: "ტესტი", price: 0, categoryId: category.id, isActive: false },
  });
  productId = product.id;

  await db.productSupply.createMany({
    data: [
      { productId, supplierId: cheap.id, supplierSku: "A", cost: 100, qty: 5 },
      { productId, supplierId: pricey.id, supplierSku: "B", cost: 400, qty: 5 },
    ],
  });

  await repriceProduct(productId);
  const after1 = await db.product.findUnique({ where: { id: productId }, select: { price: true, cost: true } });
  assert.equal(after1?.cost, 100, "თვითღირებულება იაფი მიმწოდებლისა უნდა იყოს");
  assert.equal(after1?.price, 130, "საცალო = 100 × 1.3");

  // ძვირი მიმწოდებელი cost-ს გადააწერს (როგორც სინქი აკეთებს) — გადათვლამ უნდა გაასწოროს
  await db.product.update({ where: { id: productId }, data: { cost: 400 } });
  await repriceProduct(productId);

  const after2 = await db.product.findUnique({ where: { id: productId }, select: { price: true, cost: true } });
  assert.equal(after2?.cost, 100, "ფასის უცვლელობისას cost მაინც უნდა გასწორდეს");
  assert.ok(after2!.price >= after2!.cost!, "ფასი თვითღირებულებაზე დაბალი არ უნდა იყოს");
});
