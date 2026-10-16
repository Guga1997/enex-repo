/**
 * კატეგორიების რუკის გამოყენება.
 *
 *   npx tsx scripts/apply-category-map.ts          — ჯერ ნახვა, ცვლილების გარეშე
 *   npx tsx scripts/apply-category-map.ts --write  — შექმნა და მიბმა
 *
 * სამ რამეს აკეთებს:
 *  1. data/muk-categories.json-ის ხეს ქმნის (რაც აკლია);
 *  2. რუკას MUK-ის fieldMap-ში წერს, რომ მომდევნო სინქმა თვითონ დაალაგოს;
 *  3. „დაუკატეგორიებელში“ ჩავარდნილ პროდუქტებს მაშინვე გადაიტანს.
 *
 * MUK-ის XML IP-ით არის შეზღუდული — სერვერზე უნდა გაეშვას.
 */
import { readFileSync } from "fs";
import path from "path";
import { db } from "../src/lib/db";
import { FALLBACK } from "../src/lib/suppliers";
import { slugify } from "../src/lib/format";

const WRITE = process.argv.includes("--write");
const map = JSON.parse(readFileSync(path.join(process.cwd(), "data", "muk-categories.json"), "utf8")) as Record<
  string,
  string[] | string
>;
const entries = Object.entries(map).filter(([k, v]) => !k.startsWith("_") && Array.isArray(v)) as [string, string[]][];

/** კატეგორია სახელით, რეგისტრის გარეშე — სინქიც ასე ეძებს */
async function findByName(nameKa: string) {
  const all = await db.category.findMany({ select: { id: true, nameKa: true } });
  return all.find((c) => c.nameKa.trim().toLowerCase() === nameKa.trim().toLowerCase()) ?? null;
}

async function ensureTree(tree: string[]): Promise<string | null> {
  let parentId: string | null = null;
  for (const nameKa of tree) {
    const hit = await findByName(nameKa);
    if (hit) {
      parentId = hit.id;
      continue;
    }
    if (!WRITE) {
      console.log(`  + ${tree.slice(0, tree.indexOf(nameKa) + 1).join(" > ")}`);
      return null;
    }
    let slug = slugify(nameKa) || `cat-${Date.now()}`;
    while (await db.category.findUnique({ where: { slug }, select: { id: true } })) slug += "-2";
    const made: { id: string } = await db.category.create({
      data: { slug, nameKa, parentId },
      select: { id: true },
    });
    console.log(`  + ${tree.slice(0, tree.indexOf(nameKa) + 1).join(" > ")}`);
    parentId = made.id;
  }
  return parentId;
}

(async () => {
  console.log(WRITE ? "— ცვლილებებით —" : "— მხოლოდ ნახვა (--write რომ გაუშვა, შეიცვლება) —");

  // 1. ხე
  console.log("\nკატეგორიები:");
  const idOf = new Map<string, string | null>();
  for (const tree of new Set(entries.map(([, v]) => v.join("\u0000")))) {
    const p = tree.split("\u0000");
    idOf.set(tree, await ensureTree(p));
  }

  // 2. MUK-ის fieldMap
  const muk = await db.supplier.findUnique({ where: { slug: "muk" } });
  if (muk) {
    const field = muk.fieldMap?.trim() ? JSON.parse(muk.fieldMap) : {};
    const before = Object.keys(field.categories ?? {}).length;
    field.categories = { ...(field.categories ?? {}), ...Object.fromEntries(entries) };
    console.log(`\nMUK-ის რუკა: ${before} → ${Object.keys(field.categories).length} ჩანაწერი`);
    if (WRITE) await db.supplier.update({ where: { id: muk.id }, data: { fieldMap: JSON.stringify(field, null, 2) } });
  }

  // 3. უკვე ჩავარდნილები
  const fallback = await db.category.findFirst({ where: { nameKa: FALLBACK }, select: { id: true } });
  if (!fallback) {
    await db.$disconnect();
    return;
  }

  const products = await db.product.findMany({
    where: { categoryId: fallback.id },
    select: { id: true, sku: true, supplies: { select: { supplierSku: true, supplier: { select: { slug: true } } } } },
  });

  // MUK-ის XML-იდან — რომელი პროდუქტი რომელ კატეგორიაშია მასთან
  const mukCat = new Map<string, string>();
  if (muk?.baseUrl) {
    const xml = await (await fetch(muk.baseUrl, { cache: "no-store" })).text();
    for (const block of xml.split("<Product ").slice(1)) {
      const sku = block.match(/<VENDOR_PART_NUMBER>([^<]*)</)?.[1]?.trim();
      if (!sku) continue;
      const cat = block.match(/<CATEGORY>([^<]*)</)?.[1]?.trim() ?? "";
      const kod2 = block.match(/<KOD2>([^<]*)</)?.[1]?.trim() ?? "";
      const key = map[`${cat}/${kod2}`] ? `${cat}/${kod2}` : map[cat] ? cat : "";
      if (key) mukCat.set(sku.toUpperCase(), key);
    }
  }

  let moved = 0;
  const perCat = new Map<string, number>();
  for (const p of products) {
    const sku = p.supplies.find((s) => s.supplier.slug === "muk")?.supplierSku;
    const key = sku ? mukCat.get(sku.toUpperCase()) : undefined;
    if (!key) continue;
    const tree = (map[key] as string[]).join("\u0000");
    const categoryId = idOf.get(tree);
    perCat.set(tree, (perCat.get(tree) ?? 0) + 1);
    moved++;
    if (WRITE && categoryId) await db.product.update({ where: { id: p.id }, data: { categoryId } });
  }

  console.log(`\nგადატანილი პროდუქტი: ${moved} / ${products.length}`);
  for (const [t, n] of [...perCat].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${t.split("\u0000").join(" > ")}`);
  }
  if (!WRITE) console.log("\nცვლილება არ შევიდა. გასაშვებად: --write");

  await db.$disconnect();
})();
