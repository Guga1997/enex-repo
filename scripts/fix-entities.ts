/**
 * პროდუქტის სახელებში, აღწერებში და მახასიათებლებში დარჩენილი HTML კოდები (&quot; &amp;) → ნამდვილი სიმბოლოები.
 *   npx tsx scripts/fix-entities.ts            — მხოლოდ დათვლა
 *   npx tsx scripts/fix-entities.ts --write    — ჩაწერა
 */
import { db } from "../src/lib/db";
import { decodeEntities } from "../src/lib/suppliers/muk";

const WRITE = process.argv.includes("--write");
const FIELDS = ["nameKa", "nameEn", "nameRu", "descriptionKa", "descriptionEn", "descriptionRu", "model"] as const;

(async () => {
  const rows = await db.product.findMany({
    where: { OR: FIELDS.map((f) => ({ [f]: { contains: "&" } })) },
    select: { id: true, sku: true, nameKa: true, nameEn: true, nameRu: true, descriptionKa: true, descriptionEn: true, descriptionRu: true, model: true },
  });
  let n = 0;
  for (const r of rows) {
    const data: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = r[f];
      if (v && /&(amp|quot|#0?39|apos|lt|gt|nbsp);/.test(v)) data[f] = decodeEntities(v);
    }
    if (!Object.keys(data).length) continue;
    n++;
    if (n <= 5) console.log(r.sku, "|", r.nameKa.slice(0, 70), "→", (data.nameKa ?? r.nameKa).slice(0, 70));
    if (WRITE) await db.product.update({ where: { id: r.id }, data });
  }
  console.log(`${WRITE ? "გასწორდა" : "გასასწორებელია"}: ${n} პროდუქტი${WRITE ? "" : " (--write ჩასაწერად)"}`);

  // მახასიათებლები — ფილტრის სათაურშიც ჩანს („Display diagonal, &quot;“)
  const RE = /&(amp|quot|#0?39|apos|lt|gt|nbsp);/;
  const attrs = await db.productAttribute.findMany({
    where: { OR: [{ name: { contains: "&" } }, { value: { contains: "&" } }] },
    select: { id: true, name: true, value: true },
  });
  let m = 0;
  for (const at of attrs) {
    if (!RE.test(at.name) && !RE.test(at.value)) continue;
    m++;
    if (WRITE) await db.productAttribute.update({ where: { id: at.id }, data: { name: decodeEntities(at.name), value: decodeEntities(at.value) } });
  }
  console.log(`${WRITE ? "გასწორდა" : "გასასწორებელია"}: ${m} მახასიათებელი`);
  await db.$disconnect();
})();
