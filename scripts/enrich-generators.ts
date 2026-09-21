/**
 * გენერატორების გამდიდრება datasheet-ებიდან ამოღებული მონაცემებით (data/generators-enrich.json):
 * პროდუქტის სურათი, PDF-ის მახასიათებლები, ბრენდი Zenessis, სახელი.
 *   npx tsx scripts/enrich-generators.ts
 */
import { readFileSync } from "fs";
import { db } from "../src/lib/db";

type Entry = { engine: string; file: string; image?: string; attrs: Record<string, string> };
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

(async () => {
  const enrich = JSON.parse(readFileSync("data/generators-enrich.json", "utf8")) as Record<string, Entry>;
  const byFile = Object.values(enrich).map((e) => ({ k: key(e.file.replace(/\.pdf$/i, "")), e }));

  // ბრენდი: ZEN → Zenessis (Endress Zenessis Group)
  const zen = await db.brand.findFirst({ where: { name: "ZEN" } });
  const zenessis = await db.brand.findFirst({ where: { name: "Zenessis" } });
  if (zen && !zenessis) await db.brand.update({ where: { id: zen.id }, data: { name: "Zenessis", slug: "zenessis" } });
  else if (zen && zenessis) {
    await db.product.updateMany({ where: { brandId: zen.id }, data: { brandId: zenessis.id } });
    await db.brand.delete({ where: { id: zen.id } });
  }
  const brand = (await db.brand.findFirst({ where: { name: "Zenessis" } }))!;

  const products = await db.product.findMany({
    where: { brandId: brand.id },
    include: { images: true, attributes: true },
  });
  let imgs = 0, attrs = 0, renamed = 0;
  for (const p of products) {
    const k = key(p.model ?? p.sku);
    const hit = byFile.find((x) => x.k === k || x.k.startsWith(k + "-") || x.k.startsWith(k + "_"))?.e;
    if (!hit) { console.log("no datasheet match:", p.sku); continue; }

    if (hit.image && p.images.length === 0) {
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
    if (!p.nameKa.includes("Zenessis")) {
      await db.product.update({ where: { id: p.id }, data: { nameKa: p.nameKa.replace("დიზელის გენერატორი ZEN", "დიზელის გენერატორი Zenessis ZEN") } });
      renamed++;
    }
  }
  console.log(`პროდუქტი ${products.length}: სურათი +${imgs}, მახასიათებელი +${attrs}, სახელი ${renamed}`);
  await db.$disconnect();
})();
