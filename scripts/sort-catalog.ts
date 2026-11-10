/**
 * კატალოგის გადალაგება: ყველა პროდუქტი თავის ქვეკატეგორიაში (წესები — src/lib/category-rules.ts).
 *
 *   npx tsx scripts/sort-catalog.ts            — მშრალი გაშვება, მხოლოდ ანგარიში
 *   npx tsx scripts/sort-catalog.ts --write    — ჩაწერა
 *
 * რას აკეთებს:
 *  1. ქმნის ახალ კატეგორიებს, რომლებსაც წესები იყენებს (სერვერები, PDU, კვების ბლოკები…);
 *  2. ყველა პროდუქტს ატარებს წესებში და გადააქვს, სადაც წესი ემთხვევა;
 *  3. რთავს გამორთულ კატეგორიას, თუ მასში ხილული პროდუქტი აღმოჩნდა (მშობლებიც ჩართული უნდა იყოს);
 *  4. ბოლოს აჩვენებს, რა დარჩა ზოგად კატეგორიაში და რომელი ჩართული კატეგორიაა ცარიელი.
 * გამეორება უსაფრთხოა — უკვე სწორ ადგილას მყოფს არ ეხება.
 */
import { db } from "../src/lib/db";
import { slugify } from "../src/lib/format";
import { FALLBACK_CATEGORY, NEW_CATEGORIES, refineCategory } from "../src/lib/category-rules";

const WRITE = process.argv.includes("--write");
/** განზრახ გამორთული ტოტები — აქ არაფერს ვრთავთ */
const KEEP_OFF = new Set([FALLBACK_CATEGORY, "კომპიუტერის კომპონენტები"]);

type Cat = { id: string; nameKa: string; slug: string; parentId: string | null; isActive: boolean };

async function loadCats() {
  const all: Cat[] = await db.category.findMany({ select: { id: true, nameKa: true, slug: true, parentId: true, isActive: true } });
  const byId = new Map(all.map((c) => [c.id, c]));
  const pathOf = (id: string): string[] => {
    const out: string[] = [];
    for (let c = byId.get(id); c; c = c.parentId ? byId.get(c.parentId) : undefined) out.unshift(c.nameKa);
    return out;
  };
  const idByPath = new Map(all.map((c) => [pathOf(c.id).join(" > "), c.id]));
  return { all, byId, pathOf, idByPath };
}

(async () => {
  // 1. ახალი კატეგორიები
  let { idByPath } = await loadCats();
  for (const nc of NEW_CATEGORIES) {
    const key = nc.path.join(" > ");
    if (idByPath.has(key)) continue;
    const parentId = idByPath.get(nc.path.slice(0, -1).join(" > "));
    if (!parentId) {
      console.log(`⚠ მშობელი კატეგორია არ არსებობს, გამოტოვებულია: ${key}`);
      continue;
    }
    console.log(`+ კატეგორია: ${key}`);
    if (!WRITE) continue;
    let slug = slugify(nc.nameEn) || slugify(nc.path.at(-1)!) || `cat-${Date.now()}`;
    while (await db.category.findUnique({ where: { slug }, select: { id: true } })) slug += "-2";
    const max = await db.category.aggregate({ where: { parentId }, _max: { sortOrder: true } });
    await db.category.create({
      data: { slug, nameKa: nc.path.at(-1)!, nameEn: nc.nameEn, nameRu: nc.nameRu, parentId, isActive: true, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
  }

  // 2. პროდუქტები
  const cats = await loadCats();
  idByPath = cats.idByPath;
  const products = await db.product.findMany({
    select: { id: true, sku: true, nameKa: true, model: true, categoryId: true, brand: { select: { name: true } } },
  });
  const moves = new Map<string, string[]>();
  const missing = new Set<string>();
  let moved = 0;
  for (const p of products) {
    const cur = cats.pathOf(p.categoryId);
    const next = refineCategory({ name: p.nameKa, brand: p.brand?.name, model: p.model, sku: p.sku }, cur);
    if (!next) continue;
    const targetId = idByPath.get(next.join(" > "));
    if (!targetId) {
      missing.add(next.join(" > "));
      continue;
    }
    const key = `${cur.slice(-2).join(" > ")}  →  ${next.slice(-2).join(" > ")}`;
    if (!moves.has(key)) moves.set(key, []);
    moves.get(key)!.push(p.sku);
    moved++;
    if (WRITE) await db.product.update({ where: { id: p.id }, data: { categoryId: targetId } });
  }
  for (const [k, v] of [...moves].sort()) console.log(`${String(v.length).padStart(4)}  ${k}`);
  if (missing.size && WRITE) console.log(`\n⚠ კატეგორია ვერ მოიძებნა:\n  ${[...missing].join("\n  ")}`);
  console.log(`\n${WRITE ? "გადავიდა" : "გადავიდოდა"}: ${moved} პროდუქტი ${products.length}-დან`);

  // 3. გამორთული კატეგორია ხილული პროდუქტით → ირთვება (ფესვამდე)
  const after = await loadCats();
  const counts = await db.product.groupBy({ by: ["categoryId"], where: { isActive: true, price: { gt: 0 } }, _count: true });
  const visible = new Map(counts.map((c) => [c.categoryId, c._count]));
  const toEnable = new Set<string>();
  for (const [id, n] of visible) {
    if (!n) continue;
    const path = after.pathOf(id);
    if (KEEP_OFF.has(path[0])) continue;
    for (let c = after.byId.get(id); c; c = c.parentId ? after.byId.get(c.parentId) : undefined) if (!c.isActive) toEnable.add(c.id);
  }
  for (const id of toEnable) console.log(`ჩაირთო: ${after.pathOf(id).join(" > ")}`);
  if (WRITE && toEnable.size) await db.category.updateMany({ where: { id: { in: [...toEnable] } }, data: { isActive: true } });

  // 4. ანგარიში: რა დარჩა ზოგადში, რა არის ცარიელი
  const hasKids = new Set(after.all.map((c) => c.parentId).filter(Boolean) as string[]);
  const total = await db.product.groupBy({ by: ["categoryId"], _count: true });
  const totalBy = new Map(total.map((c) => [c.categoryId, c._count]));
  console.log("\nზოგად (ქვეკატეგორიიან) კატეგორიაში დარჩა:");
  for (const c of after.all) {
    const n = totalBy.get(c.id) ?? 0;
    if (n && (hasKids.has(c.id) || c.nameKa === FALLBACK_CATEGORY)) console.log(`${String(n).padStart(4)}  ${after.pathOf(c.id).join(" > ")}`);
  }
  console.log("\nჩართული, მაგრამ ცარიელი ბოლო კატეგორია:");
  for (const c of after.all) {
    if (c.isActive && !hasKids.has(c.id) && !(totalBy.get(c.id) ?? 0)) console.log(`      ${after.pathOf(c.id).join(" > ")}`);
  }
  await db.$disconnect();
})();
