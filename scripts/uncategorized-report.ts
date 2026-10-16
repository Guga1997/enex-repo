/**
 * უკატეგორიო პროდუქტების ანგარიში.
 *
 *   npx tsx scripts/uncategorized-report.ts
 *
 * „დაუკატეგორიებელი (იმპორტი)“-ში ჩავარდნილებს მიმწოდებლის საკუთარი
 * კატეგორიით აჯგუფებს — MUK-ის შემთხვევაში XML-იდან (CATEGORY / KOD2 / KOD3),
 * დანარჩენებზე ბრენდით. ასე ჩანს, რომელი ჯგუფი რა კატეგორიად უნდა გაიწეროს.
 *
 * MUK-ის XML IP-ით არის შეზღუდული — სერვერზე უნდა გაეშვას.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { db } from "../src/lib/db";
import { FALLBACK } from "../src/lib/suppliers";

type Group = { key: string; items: { sku: string; name: string; brand: string; qty: number; active: boolean }[] };

(async () => {
  const fallback = await db.category.findFirst({ where: { nameKa: FALLBACK }, select: { id: true } });
  if (!fallback) {
    console.log("დაუკატეგორიებელი კატეგორია არ არსებობს — ყველაფერი დალაგებულია");
    await db.$disconnect();
    return;
  }

  const products = await db.product.findMany({
    where: { categoryId: fallback.id },
    select: {
      id: true,
      sku: true,
      nameKa: true,
      isActive: true,
      stockQty: true,
      brand: { select: { name: true } },
      supplies: { select: { supplierSku: true, supplier: { select: { slug: true } } } },
    },
    orderBy: { nameKa: "asc" },
  });

  console.log(`უკატეგორიო პროდუქტი: ${products.length} (გამოქვეყნებული ${products.filter((p) => p.isActive).length})\n`);

  // MUK-ის საკუთარი კატეგორია XML-იდან
  const mukCat = new Map<string, string>();
  const muk = await db.supplier.findUnique({ where: { slug: "muk" } });
  if (muk?.baseUrl) {
    try {
      const xml = await (await fetch(muk.baseUrl, { cache: "no-store" })).text();
      for (const block of xml.split("<Product ").slice(1)) {
        const sku = block.match(/<VENDOR_PART_NUMBER>([^<]*)</)?.[1]?.trim();
        if (!sku) continue;
        const path = ["CATEGORY", "KOD2", "KOD3"]
          .map((t) => block.match(new RegExp(`<${t}>([^<]*)<`))?.[1]?.trim())
          .filter(Boolean);
        if (path.length) mukCat.set(sku.toUpperCase(), path.join(" / "));
      }
    } catch (e) {
      console.log("⚠ MUK-ის XML ვერ წამოვიდა:", (e as Error).message);
    }
  }

  const groups = new Map<string, Group>();
  for (const p of products) {
    const sup = p.supplies[0];
    const key =
      (sup?.supplier.slug === "muk" ? mukCat.get(sup.supplierSku.toUpperCase()) : undefined) ??
      `${sup?.supplier.slug ?? "ხელით"} · ${p.brand?.name ?? "უბრენდო"}`;
    if (!groups.has(key)) groups.set(key, { key, items: [] });
    groups.get(key)!.items.push({
      sku: p.sku,
      name: p.nameKa,
      brand: p.brand?.name ?? "",
      qty: p.stockQty,
      active: p.isActive,
    });
  }

  // შემოთავაზებული კატეგორიები — data/muk-categories.json
  let proposal: Record<string, string[]> = {};
  try {
    proposal = JSON.parse(readFileSync(path.join(process.cwd(), "data", "muk-categories.json"), "utf8"));
  } catch {
    /* რუკის გარეშეც იმუშავებს — უბრალოდ შემოთავაზება არ იქნება */
  }
  /** „Laptop / Dell Pro / 14“ → ჯერ „Laptop/Dell Pro“, მერე „Laptop“ */
  const suggest = (key: string): string[] | null => {
    const parts = key.split(" / ");
    for (let n = Math.min(parts.length, 2); n >= 1; n--) {
      const hit = proposal[parts.slice(0, n).join("/")];
      if (hit) return hit;
    }
    return null;
  };

  const csv: string[] = ["კოდი;დასახელება;მიმწოდებლის კატეგორია;შემოთავაზებული კატეგორია;ნაშთი;გამოქვეყნებული"];
  let covered = 0;

  for (const g of [...groups.values()].sort((a, b) => b.items.length - a.items.length)) {
    const to = suggest(g.key);
    if (to) covered += g.items.length;
    console.log(`\n### ${g.key} — ${g.items.length}  →  ${to ? to.join(" > ") : "???"}`);
    for (const i of g.items.slice(0, 4)) console.log(`     ${i.sku.padEnd(24)} ${i.name.slice(0, 78)}`);
    if (g.items.length > 4) console.log(`     … კიდევ ${g.items.length - 4}`);

    for (const i of g.items) {
      const cell = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
      csv.push([cell(i.sku), cell(i.name), cell(g.key), cell(to ? to.join(" > ") : ""), i.qty, i.active ? "კი" : "არა"].join(";"));
    }
  }

  const out = path.join(process.cwd(), "data", "uncategorized.csv");
  writeFileSync(out, "﻿" + csv.join("\n"), "utf8");
  console.log(`\n\nშემოთავაზებით დაფარულია ${covered}/${products.length}. სია: ${out}`);

  await db.$disconnect();
})();
