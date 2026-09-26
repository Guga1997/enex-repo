/**
 * ფილტრის ტესტები — რეალურ ბაზაზე (dev SQLite).
 *   npm test
 *
 * მთავარი, რასაც ვამოწმებთ: ფასეტში ნაჩვენები რიცხვი და გაფილტვრის შედეგი
 * ერთი და იგივეა. სწორედ აქ იყო შეცდომა — მახასიათებლის მონიშვნისას
 * სხვა მნიშვნელობები ქრებოდა და რაოდენობები ცრუობდა.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import {
  buildWhere,
  categoryIdsWithDescendants,
  getFacets,
  getProducts,
  parseQuery,
  attrKey,
  type SearchParams,
} from "../src/lib/catalog";

/** გვერდის მისამართიდან მოთხოვნა — ისე, როგორც კატალოგის გვერდი აკეთებს */
async function query(slug: string | null, sp: SearchParams) {
  let ids: string[] = [];
  if (slug) {
    const cat = await db.category.findUnique({ where: { slug }, select: { id: true } });
    assert.ok(cat, `კატეგორია ${slug} ვერ მოიძებნა`);
    ids = await categoryIdsWithDescendants(cat.id);
  }
  return parseQuery(sp, ids);
}

const count = (where: Parameters<typeof db.product.count>[0]) => db.product.count(where);

test("ფილტრის გარეშე — აქტიური პროდუქტები", async () => {
  const q = await query(null, {});
  const total = await count({ where: buildWhere(q) });
  const active = await db.product.count({ where: { isActive: true } });
  assert.equal(total, active);
});

test("ბრენდის ფასეტის რიცხვი = გაფილტვრის შედეგი", async () => {
  const q = await query(null, {});
  const facets = await getFacets(q);
  assert.ok(facets.brands.length > 0, "ბრენდები საერთოდ არ არის");

  for (const b of facets.brands.slice(0, 5)) {
    const filtered = await query(null, { brand: b.slug });
    const got = await count({ where: buildWhere(filtered) });
    assert.equal(got, b.count, `ბრენდი ${b.name}: ფასეტში ${b.count}, ფილტრით ${got}`);
  }
});

test("სტატუსის ფასეტის რიცხვი = გაფილტვრის შედეგი", async () => {
  const q = await query(null, {});
  const facets = await getFacets(q);

  for (const s of facets.statuses) {
    const filtered = await query(null, { status: s.key });
    const got = await count({ where: buildWhere(filtered) });
    assert.equal(got, s.count, `სტატუსი ${s.key}: ფასეტში ${s.count}, ფილტრით ${got}`);
  }
});

test("მახასიათებლის ფასეტის რიცხვი = გაფილტვრის შედეგი", async () => {
  const q = await query(null, {});
  const facets = await getFacets(q);
  assert.ok(facets.attributes.length > 0, "მახასიათებლები საერთოდ არ არის");

  for (const attr of facets.attributes.slice(0, 3)) {
    for (const v of attr.values.slice(0, 5)) {
      const filtered = await query(null, { [attrKey(attr.name)]: v.value });
      const got = await count({ where: buildWhere(filtered) });
      assert.equal(got, v.count, `${attr.name} = ${v.value}: ფასეტში ${v.count}, ფილტრით ${got}`);
    }
  }
});

test("მახასიათებლის მონიშვნისას დანარჩენი მნიშვნელობები არ ქრება", async () => {
  const before = await query(null, {});
  const facets = await getFacets(before);
  const attr = facets.attributes.find((a) => a.values.length > 2);
  assert.ok(attr, "ორზე მეტმნიშვნელობიანი მახასიათებელი ვერ მოიძებნა");

  const picked = attr.values[0].value;
  const after = await getFacets(await query(null, { [attrKey(attr.name)]: picked }));
  const same = after.attributes.find((a) => a.name === attr.name);

  assert.ok(same, "მონიშნული მახასიათებელი სიიდან გაქრა");
  assert.equal(
    same.values.length,
    attr.values.length,
    "მონიშვნის შემდეგ იმავე მახასიათებლის სხვა მნიშვნელობები დაიკარგა"
  );
});

test("ერთი მახასიათებლის ორი მნიშვნელობა — OR (ჯამდება)", async () => {
  const facets = await getFacets(await query(null, {}));
  const attr = facets.attributes.find((a) => a.values.length > 1);
  assert.ok(attr);

  const [a, b] = attr.values;
  const both = await query(null, { [attrKey(attr.name)]: `${a.value},${b.value}` });
  const got = await count({ where: buildWhere(both) });

  // ერთი პროდუქტი ორივე მნიშვნელობას ვერ ექნება (ერთი მახასიათებელი, ერთი მნიშვნელობა)
  assert.equal(got, a.count + b.count, `${attr.name}: ${a.count} + ${b.count} ≠ ${got}`);
});

test("ორი სხვადასხვა ფილტრი — AND (ვიწროვდება)", async () => {
  const facets = await getFacets(await query(null, {}));
  const brand = facets.brands[0];
  const status = facets.statuses[0];

  const one = await count({ where: buildWhere(await query(null, { brand: brand.slug })) });
  const two = await count({
    where: buildWhere(await query(null, { brand: brand.slug, status: status.key })),
  });
  assert.ok(two <= one, "ორი ფილტრი უფრო მეტს აჩვენებს, ვიდრე ერთი");
});

test("ფასის დიაპაზონი", async () => {
  const q = await query(null, { min: "100", max: "500" });
  const items = await db.product.findMany({ where: buildWhere(q), select: { price: true }, take: 50 });
  for (const p of items) {
    assert.ok(p.price >= 100 && p.price <= 500, `ფასი ${p.price} დიაპაზონს გარეთაა`);
  }
});

test("კატეგორია მოიცავს ქვეკატეგორიებს", async () => {
  const parent = await db.category.findFirst({
    where: { parentId: null, isActive: true, children: { some: { isActive: true } } },
    include: { children: { where: { isActive: true }, take: 1 } },
  });
  assert.ok(parent, "ქვეკატეგორიიანი სეგმენტი ვერ მოიძებნა");

  const inParent = await count({ where: buildWhere(await query(parent.slug, {})) });
  const inChild = await count({ where: buildWhere(await query(parent.children[0].slug, {})) });
  assert.ok(inParent >= inChild, "სეგმენტში ქვეჯგუფზე ნაკლები პროდუქტია");
});

test("ქართულსახელიანი მახასიათებელი მისამართში გადის და უკან იკითხება", async () => {
  const facets = await getFacets(await query(null, {}));
  const attr = facets.attributes.find((a) => /[Ⴀ-ჿ]/.test(a.name));
  assert.ok(attr, "ქართულსახელიანი მახასიათებელი ვერ მოიძებნა");

  // კლიენტი ასე აწყობს მისამართს
  const params = new URLSearchParams();
  params.set(attrKey(attr.name), attr.values[0].value);
  const url = new URL(`https://enex.ge/catalog?${params.toString()}`);

  // სერვერი ასე კითხულობს (Next-ი პარამეტრებს გაშიფრულად აძლევს)
  const sp: SearchParams = Object.fromEntries(url.searchParams.entries());
  const q = parseQuery(sp, []);
  assert.deepEqual(q.attrs[attr.name], [attr.values[0].value], "მახასიათებლის სახელი გზაში დაიკარგა");

  // და კლიენტი თავისივე გასაღებით პოულობს მონიშნულს (checkbox-ის მდგომარეობა)
  assert.equal(url.searchParams.get(attrKey(attr.name)), attr.values[0].value);
});

test("გვერდის ნომერი ფილტრის შეცვლისას არ გადადის მიღმა", async () => {
  const q = await query(null, { page: "99" });
  const { total, pages } = await getProducts(q);
  assert.ok(pages >= 1);
  assert.ok(total >= 0);
});

test.after(async () => {
  await db.$disconnect();
});
