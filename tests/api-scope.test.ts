/**
 * API გასაღების კატეგორიული შეზღუდვა.
 * საწყობის აპლიკაციის გასაღები მხოლოდ კომპიუტერის კომპონენტებს უნდა ხედავდეს —
 * გაჟონვის შემთხვევაშიც დანარჩენი კატალოგი ხელუხლებელი რჩება.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { generateApiKey } from "../src/lib/api-auth";
import { scopeIds, inScope } from "../src/lib/api-scope";
import { PC_ROOT } from "../src/lib/pc-build/specs";

const NAME = "ტესტი — არეალი";
let keyId = "";

before(async () => {
  const { hash, prefix } = generateApiKey();
  const k = await db.apiKey.create({
    data: { name: NAME, keyHash: hash, prefix, scopes: "stock:read,stock:write", categorySlug: PC_ROOT.slug },
  });
  keyId = k.id;
});

after(async () => {
  if (keyId) await db.apiKey.delete({ where: { id: keyId } }).catch(() => {});
  await db.$disconnect();
});

test("არეალი მოიცავს ქვეკატეგორიებსაც", async () => {
  const ids = await scopeIds(PC_ROOT.slug);
  assert.ok(ids && ids.length > 1, "ქვეკატეგორიები არ ჩანს");

  const cpu = await db.category.findUnique({ where: { slug: "procesorebi" }, select: { id: true } });
  assert.ok(cpu && ids!.includes(cpu.id), "პროცესორები არეალში არ არის");
});

test("სხვა კატეგორიის პროდუქტი არეალს გარეთაა", async () => {
  const other = await db.product.findFirst({
    where: { category: { slug: { notIn: ["procesorebi", "dedadapebi"] }, parentId: { not: null } } },
    select: { categoryId: true, category: { select: { nameKa: true } } },
  });
  if (!other) return;
  assert.equal(
    await inScope(PC_ROOT.slug, other.categoryId),
    false,
    `„${other.category.nameKa}“ შეზღუდულ გასაღებს არ უნდა ეხებოდეს`
  );
});

test("შეზღუდვის გარეშე გასაღები ყველაფერს ხედავს", async () => {
  assert.equal(await scopeIds(null), null);
  const any = await db.product.findFirst({ select: { categoryId: true } });
  if (any) assert.equal(await inScope(null, any.categoryId), true);
});

test("წაშლილი კატეგორიის გასაღები ვერაფერს ხედავს", async () => {
  const ids = await scopeIds("aseti-kategoria-ar-arsebobs");
  assert.deepEqual(ids, [], "არარსებულ კატეგორიაზე გასაღებს წვდომა არ უნდა ჰქონდეს");
});
