/**
 * კატალოგის აუდიტი — ეძებს მონაცემთა შეცდომებს ყველა კატეგორიაში.
 * არაფერს ცვლის, მხოლოდ ანგარიშს ბეჭდავს.
 *
 *   npx tsx scripts/audit-catalog.ts
 *   npx tsx scripts/audit-catalog.ts --full   — ყველა შემთხვევა, არა მხოლოდ პირველი 10
 */
import { existsSync } from "fs";
import path from "path";
import { db } from "../src/lib/db";

const full = process.argv.includes("--full");
const LIMIT = full ? 1000 : 10;

type Issue = { kind: string; sku: string; detail: string };
const issues: Issue[] = [];
const add = (kind: string, sku: string, detail: string) => issues.push({ kind, sku, detail });

/** რიცხვები ტექსტიდან, ერთეულთან ერთად: „1250 kVA“ → [{n:1250, unit:"kVA"}] */
function numbersWithUnit(s: string): { n: number; unit: string }[] {
  return [...s.matchAll(/(\d+(?:[.,]\d+)?)\s*([A-Za-zა-ჰ%°]+)?/g)].map((m) => ({
    n: Number(m[1].replace(",", ".")),
    unit: (m[2] ?? "").toLowerCase(),
  }));
}

(async () => {
  const products = await db.product.findMany({
    where: { isActive: true },
    select: {
      sku: true, slug: true, nameKa: true, nameEn: true, nameRu: true, model: true,
      price: true, dealerPrice: true, oldPrice: true, cost: true,
      stockQty: true, reservedQty: true, stockStatus: true,
      category: { select: { nameKa: true, isActive: true } },
      images: { select: { url: true } },
      attributes: { select: { name: true, value: true, filterable: true } },
    },
  });

  for (const p of products) {
    // — ფასი
    if (p.price <= 0) add("ფასი", p.sku, `ფასი ${p.price}`);
    if (p.dealerPrice !== null && p.dealerPrice > p.price)
      add("ფასი", p.sku, `სადილერო ${p.dealerPrice} > საცალო ${p.price}`);
    if (p.oldPrice !== null && p.oldPrice <= p.price)
      add("ფასი", p.sku, `ძველი ფასი ${p.oldPrice} ≤ მიმდინარე ${p.price} — ფასდაკლება არ არის`);
    if (p.cost !== null && p.cost > p.price) add("ფასი", p.sku, `თვითღირებულება ${p.cost} > საცალო ${p.price}`);
    if (p.price > 0 && p.price < 1) add("ფასი", p.sku, `საეჭვოდ დაბალი ფასი ${p.price}`);

    // — ნაშთი
    if (p.stockQty < 0) add("ნაშთი", p.sku, `ნაშთი ${p.stockQty}`);
    if (p.reservedQty < 0) add("ნაშთი", p.sku, `რეზერვი ${p.reservedQty}`);
    if (p.reservedQty > p.stockQty) add("ნაშთი", p.sku, `რეზერვი ${p.reservedQty} > ნაშთი ${p.stockQty}`);
    if (p.stockStatus === "IN_STOCK" && p.stockQty <= 0) add("ნაშთი", p.sku, "სტატუსი „მარაგშია“, ნაშთი 0");
    if (p.stockStatus === "OUT_OF_STOCK" && p.stockQty > 0)
      add("ნაშთი", p.sku, `სტატუსი „არ არის“, ნაშთი ${p.stockQty}`);

    // — დასახელება
    const n = p.nameKa;
    if (n.trim().length < 6) add("დასახელება", p.sku, `ძალიან მოკლე: „${n}“`);
    if (/\s{2,}/.test(n)) add("დასახელება", p.sku, `ორმაგი ღარი: „${n}“`);
    if (/[-,/]\s*$/.test(n.trim())) add("დასახელება", p.sku, `ბოლოში სასვენი ნიშანი: „${n}“`);
    if (/undefined|null|NaN|\[object/i.test(n)) add("დასახელება", p.sku, `ტექნიკური ნაგავი: „${n}“`);

    // — კატეგორია
    if (!p.category) add("კატეგორია", p.sku, "კატეგორია არ აქვს");
    else if (/დაუკატეგორიებელი/.test(p.category.nameKa)) add("კატეგორია", p.sku, "დაუკატეგორიებელია");
    else if (!p.category.isActive) add("კატეგორია", p.sku, `კატეგორია გამორთულია: ${p.category.nameKa}`);

    // — სურათი
    for (const img of p.images) {
      if (!img.url.startsWith("/uploads/")) continue;
      if (!existsSync(path.join(process.cwd(), "public", img.url))) add("სურათი", p.sku, `ფაილი არ არის: ${img.url}`);
    }

    // — მახასიათებლები
    const seen = new Map<string, string>();
    for (const a of p.attributes) {
      const v = a.value.trim();
      if (!v || v === "-" || v === "—") { add("მახასიათებელი", p.sku, `ცარიელი: ${a.name}`); continue; }
      const key = `${a.name.toLowerCase()}|${v.toLowerCase()}`;
      if (seen.has(key)) add("მახასიათებელი", p.sku, `დუბლი: ${a.name} = ${v}`);
      seen.set(key, v);

      // ჩამოჭრილი რიცხვი: მახასიათებელში „1 kVA“, სახელში კი „1250 kVA“
      for (const av of numbersWithUnit(v)) {
        if (!av.unit || av.n === 0) continue;
        const inName = numbersWithUnit(n).find(
          (x) => x.unit === av.unit && x.n !== av.n && String(x.n).startsWith(String(av.n))
        );
        if (inName) add("მახასიათებელი", p.sku, `${a.name} = „${v}“, სახელში კი ${inName.n} ${inName.unit}`);
      }
    }

    // — თარგმანი
    if (p.nameEn && p.nameEn === p.nameKa && /[Ⴀ-ჿ]/.test(p.nameKa))
      add("თარგმანი", p.sku, "ინგლისური = ქართული");
  }

  // — კატეგორიები პროდუქტის გარეშე
  const cats = await db.category.findMany({
    where: { isActive: true },
    select: { nameKa: true, slug: true, _count: { select: { products: true, children: true } } },
  });
  for (const c of cats) {
    if (c._count.products === 0 && c._count.children === 0)
      add("კატეგორია", c.slug, `„${c.nameKa}“ ცარიელია (არც პროდუქტი, არც ქვეჯგუფი)`);
  }

  // — ერთნაირი მნიშვნელობები სხვადასხვა სახით (ფილტრი ორად იშლება)
  const attrs = await db.productAttribute.findMany({
    where: { filterable: true },
    select: { name: true, value: true },
  });
  const variants = new Map<string, Set<string>>();
  for (const a of attrs) {
    const key = `${a.name}|${a.value.toLowerCase().replace(/[\s.,]/g, "")}`;
    const set = variants.get(key) ?? new Set();
    set.add(a.value);
    variants.set(key, set);
  }
  for (const [key, set] of variants) {
    if (set.size > 1) add("ფილტრი", key.split("|")[0], `ერთი მნიშვნელობა რამდენიმე სახით: ${[...set].join(" / ")}`);
  }

  // — ანგარიში
  const byKind = new Map<string, Issue[]>();
  for (const i of issues) byKind.set(i.kind, [...(byKind.get(i.kind) ?? []), i]);

  console.log(`შემოწმდა ${products.length} პროდუქტი, ${cats.length} კატეგორია\n`);
  if (!issues.length) console.log("✓ შეცდომა არ მოიძებნა");
  for (const [kind, list] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n### ${kind} — ${list.length}`);
    for (const i of list.slice(0, LIMIT)) console.log(`  ${i.sku}: ${i.detail}`);
    if (list.length > LIMIT) console.log(`  … კიდევ ${list.length - LIMIT} (--full)`);
  }
  await db.$disconnect();
})();
