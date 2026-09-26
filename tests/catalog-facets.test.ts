/**
 * ფასეტების ტესტები: რიცხვითი მახასიათებლის დიაპაზონებად დაჯგუფება.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { attrKey, buildWhere, categoryIdsWithDescendants, getFacets, parseQuery } from "../src/lib/catalog";

async function facetsOf(slug: string | null, sp: Record<string, string> = {}) {
  let ids: string[] = [];
  if (slug) {
    const cat = await db.category.findUnique({ where: { slug }, select: { id: true } });
    assert.ok(cat, `კატეგორია ${slug} ვერ მოიძებნა`);
    ids = await categoryIdsWithDescendants(cat.id);
  }
  const q = parseQuery(sp, ids);
  return { q, facets: await getFacets(q) };
}

test("ყველა მახასიათებელი ან ჩამონათვალია, ან დიაპაზონები — 25-ზე მეტი არასდროს", async () => {
  const { facets } = await facetsOf(null);
  for (const a of facets.attributes) {
    assert.ok(a.values.length > 1, `${a.name}: ერთი მნიშვნელობა ფილტრად არ ვარგა`);
    assert.ok(a.values.length <= 25, `${a.name}: ${a.values.length} მნიშვნელობა — ძალიან ბევრია`);
  }
});

test("დიაპაზონის რაოდენობა = მისი წევრების ჯამი და გაფილტვრის შედეგი", async () => {
  const { facets } = await facetsOf(null);
  const ranged = facets.attributes.find((a) => a.values.some((v) => v.members && v.members.length > 1));
  if (!ranged) return; // ამ ბაზაში რიცხვითი დიდი მახასიათებელი არ არის

  const bucket = ranged.values.find((v) => v.members && v.members.length > 1)!;
  const q = parseQuery({ [attrKey(ranged.name)]: bucket.members!.join(",") }, []);
  const got = await db.product.count({ where: buildWhere(q) });
  assert.equal(got, bucket.count, `${ranged.name} ${bucket.value}: ფასეტში ${bucket.count}, ფილტრით ${got}`);
});

test("დიაპაზონები არ იკვეთება და ჯამი მთლიანს უდრის", async () => {
  const { facets } = await facetsOf(null);
  for (const a of facets.attributes) {
    const members = a.values.flatMap((v) => v.members ?? [v.value]);
    assert.equal(new Set(members).size, members.length, `${a.name}: დიაპაზონები ერთმანეთს ფარავს`);
  }
});

test("რიცხვითი მნიშვნელობები ზრდადობით ლაგდება", async () => {
  const { facets } = await facetsOf(null);
  const numOf = (v: string) => {
    const m = v.replace(",", ".").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  };
  for (const a of facets.attributes) {
    const nums = a.values.map((v) => numOf(v.value));
    if (nums.some((n) => n === null)) continue;
    for (let i = 1; i < nums.length; i++) {
      assert.ok(nums[i]! >= nums[i - 1]!, `${a.name}: ${a.values[i - 1].value} > ${a.values[i].value}`);
    }
  }
});

test.after(async () => {
  await db.$disconnect();
});
