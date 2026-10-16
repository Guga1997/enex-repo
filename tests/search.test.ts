/**
 * ძებნის ტესტები — რეგისტრი მნიშვნელობა არ უნდა ჰქონდეს.
 * PostgreSQL-ზე LIKE რეგისტრს ითვალისწინებდა: „bluetti“ ვერ პოულობდა „Bluetti“-ს.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { buildWhere, parseQuery } from "../src/lib/catalog";
import { productFilter } from "../src/lib/admin-filters";
import { searchTerms, synonyms } from "../src/lib/search-terms";

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

/* ------------------- ქართული სიტყვა ინგლისურ დასახელებაში ------------------- */

test("სინონიმები ორივე მიმართულებით მუშაობს", () => {
  assert.ok(synonyms("ლეპტოპი").includes("laptop"), "ლეპტოპი → laptop");
  assert.ok(synonyms("ლეპტოპებს").includes("notebook"), "ბრუნვაც უნდა დაიჭიროს");
  assert.ok(synonyms("laptop").some((s) => s.startsWith("ლეპტოპ")), "laptop → ლეპტოპ");
  assert.ok(synonyms("ყურსასმენები").includes("headset"));
  assert.ok(synonyms("მაუსი").includes("mouse"));
  assert.deepEqual(synonyms("dell"), [], "ბრენდს სინონიმი არ უნდა ჰქონდეს");
  assert.deepEqual(synonyms("ა"), [], "ერთასოიანი არაფერს უნდა გააფართოოს");
});

test("მოთხოვნა სიტყვებად იშლება და თითოეული ცალკე ემთხვევა", () => {
  const terms = searchTerms("dell ლეპტოპი");
  assert.equal(terms.length, 2);
  assert.ok(terms[1].variants.includes("laptop"));
  assert.ok(terms[0].variants.includes("dell"), "საკუთარი სიტყვაც რჩება");
  assert.equal(searchTerms("a b").length, 0, "ორზე მოკლე სიტყვები იფილტრება");
  assert.ok(searchTerms("ერთი ორი სამი ოთხი ხუთი ექვსი შვიდი").length <= 6, "სიტყვების რაოდენობა შეზღუდულია");
});

test("კატეგორიის სახელითაც იძებნება", async () => {
  const p = await db.product.findFirst({
    where: { isActive: true, price: { gt: 0 }, category: { nameKa: { not: "" } } },
    select: { category: { select: { nameKa: true } } },
  });
  assert.ok(p, "პროდუქტი ვერ მოიძებნა");
  const word = p.category.nameKa.split(/[\s(]+/).find((w) => w.length >= 4);
  assert.ok(word, "კატეგორიის სახელში ოთხასოიანი სიტყვა ვერ ვიპოვე");
  assert.ok(await countBy(word) > 0, `„${word}“ (კატეგორია) არაფერს პოულობს`);
});
