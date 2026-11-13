/**
 * AI ასისტენტის API (/api/assistant/*) — რეალურ ბაზაზე (dev SQLite).
 *
 * მთავარი: გარეთ გადის მხოლოდ საჯარო ველები და მხოლოდ ის პროდუქტი, რაც საიტზე ჩანს;
 * გასაღების გარეშე — 401.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { buildWhere } from "../src/lib/catalog";
import {
  LIMIT_DEFAULT, LIMIT_MAX, authorize, categoryTree, getProduct, parseLimit, searchProducts, storeInfo,
} from "../src/lib/assistant";

const KEY = "test-" + "k".repeat(40);
const P = "ASSISTTEST-";
const req = (auth?: string) =>
  new Request("http://localhost/api/assistant/products", { headers: auth ? { authorization: auth } : {} });

after(async () => {
  await db.product.deleteMany({ where: { sku: { startsWith: P } } });
  await db.$disconnect();
});

const VISIBLE = buildWhere({
  categoryIds: [], brands: [], statuses: [], discount: false, isNew: false, sort: "default", page: 1, attrs: {},
});

/** ველები, რომლებიც პასუხში დასაშვებია — ახალი ველის დამატება აქაც უნდა ჩაიწეროს, შეგნებულად */
const LIST_KEYS = [
  "id", "sku", "name", "brand", "model", "category", "categorySlug", "price", "currency", "oldPrice",
  "discountPercent", "unit", "minQty", "qtyStep", "stock", "isNew", "warrantyMonths", "shortDescription",
  "attributes", "url", "imageUrl", "updatedAt",
];
const FULL_KEYS = [...LIST_KEYS, "description", "images", "documents", "weightKg"];
const STOCK_KEYS = ["status", "label", "canOrder", "quantity", "expectedDate"];
/** შიდა მონაცემი, რომელიც არასდროს უნდა გავიდეს */
const SECRET = /cost|dealer|listPrice|supplier|supply|priceLocked|stockAdjust|reservedQty|sortOrder/i;

test("გასაღების გარეშე, არასწორით ან დაუყენებელი გასაღებით — 401", async () => {
  process.env.ASSISTANT_API_KEY = KEY;
  assert.equal(authorize(req())?.status, 401);
  assert.equal(authorize(req("Bearer wrong-key"))?.status, 401);
  assert.equal(authorize(req(KEY))?.status, 401, "Bearer-ის გარეშე");
  assert.equal(authorize(req(`Bearer ${KEY}`)), null);
  assert.equal(authorize(req(`bearer ${KEY}`)), null, "სქემა რეგისტრს არ არჩევს");

  // გასაღები არ არის დაყენებული ან მოკლეა → ყველას უარი, ცარიელი Bearer-იც კი
  process.env.ASSISTANT_API_KEY = "";
  assert.equal(authorize(req("Bearer "))?.status, 401);
  process.env.ASSISTANT_API_KEY = "short";
  assert.equal(authorize(req("Bearer short"))?.status, 401);
  process.env.ASSISTANT_API_KEY = KEY;

  const body = await authorize(req())!.json();
  assert.ok(body.error);
});

test("limit: ნაგულისხმევი 10, მაქსიმუმ 30", () => {
  assert.equal(parseLimit(null), LIMIT_DEFAULT);
  assert.equal(parseLimit("abc"), LIMIT_DEFAULT);
  assert.equal(parseLimit("0"), LIMIT_DEFAULT);
  assert.equal(parseLimit("-5"), LIMIT_DEFAULT);
  assert.equal(parseLimit("7"), 7);
  assert.equal(parseLimit("500"), LIMIT_MAX);
});

test("ძებნა კოდით პოულობს სწორედ იმ პროდუქტს; პასუხში მხოლოდ საჯარო ველებია", async () => {
  const p = await db.product.findFirst({ where: VISIBLE, select: { id: true, sku: true, price: true, slug: true } });
  assert.ok(p, "ბაზაში ხილული პროდუქტი არ არის");
  const r = await searchProducts({ q: p.sku, limit: 5 });
  assert.ok(!("error" in r));
  assert.equal(r.items[0]?.id, p.id);
  assert.equal(r.items[0].price, p.price);
  assert.ok(r.items[0].url.endsWith(`/product/${p.slug}`));
  assert.ok(r.count <= 5 && r.total >= r.count);

  for (const it of r.items) {
    for (const k of Object.keys(it)) assert.ok(LIST_KEYS.includes(k), `მოულოდნელი ველი: ${k}`);
    assert.deepEqual(Object.keys(it.stock), STOCK_KEYS);
    assert.ok(it.attributes.length <= 8);
  }
  assert.doesNotMatch(JSON.stringify(r).replace(/"(shortDescription|name|value|label)":"[^"]*"/g, ""), SECRET);

  // რეგისტრი არ მოქმედებს
  const upper = await searchProducts({ q: p.sku.toUpperCase() });
  const lower = await searchProducts({ q: p.sku.toLowerCase() });
  assert.ok(!("error" in upper) && !("error" in lower));
  assert.equal(upper.items[0]?.id, lower.items[0]?.id);
});

test("არარსებული სიტყვა — ცარიელი სია, არა შეცდომა", async () => {
  const r = await searchProducts({ q: "zzqxjv-არარსებული-48151623" });
  assert.ok(!("error" in r));
  assert.equal(r.total, 0);
  assert.deepEqual(r.items, []);
});

test("რამდენიმე სიტყვა — ყველა უნდა ემთხვეოდეს", async () => {
  const p = await db.product.findFirst({ where: VISIBLE, select: { sku: true } });
  const r = await searchProducts({ q: `${p!.sku} zzqxjv48151623` });
  assert.ok(!("error" in r));
  assert.equal(r.total, 0);
});

test("გათიშული და უფასო პროდუქტი არც ძებნაში ჩანს და არც პირდაპირი მოთხოვნით", async () => {
  const cat = await db.category.findFirst({ where: { isActive: true }, select: { id: true } });
  const mk = (sku: string, data: object) =>
    db.product.create({
      data: { sku: P + sku, slug: (P + sku).toLowerCase(), nameKa: `ასისტტესტი ${sku}`, price: 100, categoryId: cat!.id, ...data },
    });
  const off = await mk("OFF", { isActive: false, cost: 55, dealerPrice: 60 });
  // ფასის გარეშე („ფასი მოთხოვნით“) პროდუქტს ბაზაში ვეძებთ და არ ვქმნით: ჩართული უფასო
  // პროდუქტი კატალოგის ტესტებს, რომლებიც პარალელურად ითვლის, რიცხვებს აურევდა
  const free = await db.product.findFirst({ where: { isActive: true, price: 0 }, select: { id: true, sku: true } });

  const r = await searchProducts({ q: P });
  assert.ok(!("error" in r));
  assert.equal(r.items.filter((i) => i.sku.startsWith(P)).length, 0);
  for (const x of [off, ...(free ? [free] : [])]) {
    assert.equal(await getProduct(x.id, "ka"), null);
    assert.equal(await getProduct(x.sku, "ka"), null);
  }
});

test("ერთი პროდუქტი id-ით და კოდით — სრული ვერსია, ისევ მხოლოდ საჯარო ველები", async () => {
  const p = await db.product.findFirst({
    where: { AND: [VISIBLE, { attributes: { some: {} } }] },
    select: { id: true, sku: true, _count: { select: { attributes: true } } },
  });
  assert.ok(p);
  const byId = await getProduct(p.id, "ka");
  const bySku = await getProduct(p.sku.toLowerCase(), "ka");
  assert.ok(byId && bySku);
  assert.equal(byId.id, bySku.id);
  assert.equal(byId.attributes.length, p._count.attributes, "ყველა მახასიათებელი");
  for (const k of Object.keys(byId)) assert.ok(FULL_KEYS.includes(k), `მოულოდნელი ველი: ${k}`);
  assert.equal(await getProduct("no-such-product-48151623", "ka"), null);
});

test("inStock=1 — მხოლოდ ის, რისი ყიდვაც ახლავე შეიძლება", async () => {
  const r = await searchProducts({ inStock: true, limit: 30 });
  assert.ok(!("error" in r));
  for (const it of r.items) {
    assert.equal(it.stock.status, "in_stock");
    assert.ok(it.stock.canOrder && (it.stock.quantity ?? 0) > 0);
  }
});

test("კატეგორია: slug-ით ფილტრავს, უცნობზე — შეცდომა", async () => {
  const tree = await categoryTree("ka");
  const walk = (n: (typeof tree)[number]): (typeof tree)[number][] => [n, ...n.children.flatMap(walk)];
  const all = tree.flatMap(walk);
  assert.ok(all.length > 0);
  for (const c of all) assert.deepEqual(Object.keys(c), ["name", "slug", "path", "productCount", "url", "children"]);

  const full = all.find((c) => c.productCount > 0 && c.children.length === 0);
  assert.ok(full);
  const r = await searchProducts({ category: full.slug, limit: 30 });
  assert.ok(!("error" in r));
  assert.equal(r.total, full.productCount);
  for (const it of r.items) assert.equal(it.categorySlug, full.slug);

  const bad = await searchProducts({ category: "no-such-category-48151623" });
  assert.ok("error" in bad);
});

test("მაღაზიის ინფორმაცია: მიწოდება, გადახდა, გარანტია, დაბრუნება, კონტაქტი", () => {
  const info = storeInfo("ka");
  for (const h of ["## მიწოდება", "## გადახდა", "## გარანტია", "## დაბრუნება", "## კონტაქტი"])
    assert.ok(info.markdown.includes(h), h);
  assert.ok(info.markdown.includes("14 კალენდარული დღ"));
  assert.equal(info.delivery.fee, 15);
  assert.equal(info.delivery.freeFrom, 200);
  assert.ok(info.missing.includes("whatsapp"));
  assert.ok(storeInfo("en").markdown.includes("## Delivery"));
  assert.doesNotMatch(JSON.stringify(info), /IBAN|SELLER_BANK|ს\/კ/);
});
