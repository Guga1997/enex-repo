/**
 * ძებნის ტესტები — რეგისტრი მნიშვნელობა არ უნდა ჰქონდეს.
 * PostgreSQL-ზე LIKE რეგისტრს ითვალისწინებდა: „bluetti“ ვერ პოულობდა „Bluetti“-ს.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { buildWhere, parseQuery } from "../src/lib/catalog";
import { productFilter } from "../src/lib/admin-filters";

const countBy = (q: string) => db.product.count({ where: buildWhere(parseQuery({ q }, [])) });

test("კატალოგის ძებნა რეგისტრს არ არჩევს", async () => {
  const sample = await db.product.findFirst({
    where: { isActive: true, price: { gt: 0 }, nameKa: { contains: "a" } },
    select: { nameKa: true },
  });
  assert.ok(sample, "ლათინურასოიანი პროდუქტი ვერ მოიძებნა");
  const word = sample.nameKa.match(/[A-Za-z]{4,}/)?.[0];
  assert.ok(word, "ოთხასოიანი სიტყვა ვერ ვიპოვე");

  const upper = await countBy(word.toUpperCase());
  const lower = await countBy(word.toLowerCase());
  assert.ok(lower > 0, `„${word.toLowerCase()}“ არაფერს პოულობს`);
  assert.equal(lower, upper, `„${word}“: პატარა ასოებით ${lower}, დიდით ${upper}`);
});

test("ადმინის ძებნა SKU-ს რეგისტრის გარეშე პოულობს", async () => {
  const p = await db.product.findFirst({ where: { sku: { contains: "A" } }, select: { sku: true } });
  if (!p) return;
  const [lo, up] = await Promise.all([
    db.product.count({ where: productFilter({ q: p.sku.toLowerCase() }) }),
    db.product.count({ where: productFilter({ q: p.sku.toUpperCase() }) }),
  ]);
  assert.ok(lo > 0 && lo === up, `SKU ${p.sku}: პატარათი ${lo}, დიდით ${up}`);
});

test("ადმინის ძებნა დამალულ პროდუქტსაც პოულობს", async () => {
  const hidden = await db.product.findFirst({ where: { isActive: false }, select: { sku: true } });
  if (!hidden) return;
  const n = await db.product.count({ where: productFilter({ q: hidden.sku }) });
  assert.ok(n > 0, `დამალული ${hidden.sku} ადმინის სიაში არ ჩანს`);
});

test.after(async () => {
  await db.$disconnect();
});
