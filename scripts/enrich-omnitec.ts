/**
 * Omnitec-ის პროდუქტების გამდიდრება (data/omnitec-enrich.json): სურათი და მახასიათებლები.
 *   photos[] — ქარხნული ფოტოები omnitecsystems.com-იდან; ასეთის არსებობისას ისინი ენიჭება
 *              პროდუქტს (ფასთა ნუსხის PDF-იდან ამოჭრილი სურათი იცვლება).
 *   image    — სათადარიგო: PDF-იდან ამოღებული სურათი.
 * იდემპოტენტურია.
 *   npx tsx scripts/enrich-omnitec.ts
 */
import { readFileSync } from "fs";
import { db } from "../src/lib/db";

type Entry = { page: number; sheet: string; image?: string; photos?: string[]; attrs: Record<string, string> };

(async () => {
  const enrich = JSON.parse(readFileSync("data/omnitec-enrich.json", "utf8")) as Record<string, Entry>;
  const brand = await db.brand.findFirst({ where: { name: "Omnitec" } });
  if (!brand) { console.log("ბრენდი Omnitec ვერ მოიძებნა — ჯერ სინქი გაუშვი"); return; }

  const products = await db.product.findMany({ where: { brandId: brand.id }, include: { images: true, attributes: true } });
  let imgs = 0, attrs = 0, miss = 0;
  for (const p of products) {
    const hit = enrich[p.sku];
    if (!hit) { miss++; continue; }
    if (hit.photos?.length) {
      const have = p.images.sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.url);
      if (have.join("|") !== hit.photos.join("|")) {
        await db.productImage.deleteMany({ where: { productId: p.id } });
        await db.productImage.createMany({
          data: hit.photos.map((url, i) => ({ productId: p.id, url, alt: p.nameKa, sortOrder: i })),
        });
        imgs += hit.photos.length;
      }
    } else if (hit.image && p.images.length === 0) {
      await db.productImage.create({ data: { productId: p.id, url: hit.image, alt: p.nameKa, sortOrder: 0 } });
      imgs++;
    }
    const have = new Set(p.attributes.map((a) => a.name));
    const add = Object.entries(hit.attrs).filter(([n]) => !have.has(n));
    if (add.length) {
      await db.productAttribute.createMany({
        data: add.map(([name, value], i) => ({ productId: p.id, name, value, sortOrder: p.attributes.length + i })),
      });
      attrs += add.length;
    }
  }
  console.log(`პროდუქტი ${products.length}: სურათი +${imgs}, მახასიათებელი +${attrs}, უცნობი ${miss}`);
  await db.$disconnect();
})();
