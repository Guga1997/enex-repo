/**
 * მიმწოდებლის პროდუქტების კატეგორიების თავიდან განსაზღვრა — მიმწოდებლის მიმდინარე გზით.
 * გამოსადეგია ხის შეცვლის ან დამთხვევის წესის დახვეწის მერე.
 *   npx tsx scripts/recategorize.ts            — მშრალი გაშვება, მხოლოდ ანგარიში
 *   npx tsx scripts/recategorize.ts --apply    — ცვლილებების ჩაწერა
 * ხელით შეცვლილ კატეგორიას ვერ ვარჩევთ სინქისგან — ამიტომ მხოლოდ იმას ვცვლით, რაც ბუნდოვანია
 * (ფსკერი/ფესვი) ან რაც ფოთოლზე ბრმა გადატანით მოხვდა (--all ყველას თავიდან ითვლის).
 */
import { db } from "../src/lib/db";
import { resolveAdapter, type SupplierConfig } from "../src/lib/suppliers";
import { resolveCategoryId, FALLBACK } from "../src/lib/suppliers/index";

const apply = process.argv.includes("--apply");
const all = process.argv.includes("--all");

(async () => {
  const suppliers = await db.supplier.findMany({ where: { isActive: true } });
  let changed = 0, kept = 0, unresolved = 0;
  const moves = new Map<string, number>();

  for (const s of suppliers) {
    const cfg: SupplierConfig = { slug: s.slug, name: s.name, baseUrl: s.baseUrl, authType: s.authType, secret: s.secret, authHeader: s.authHeader, fieldMap: s.fieldMap };
    const items = await resolveAdapter(s.adapter).fetchItems(cfg);
    const pathBySku = new Map(items.map((i) => [i.supplierSku, i.categoryPath]));
    const supplies = await db.productSupply.findMany({
      where: { supplierId: s.id },
      include: { product: { include: { category: true } } },
    });
    for (const sup of supplies) {
      const path = pathBySku.get(sup.supplierSku);
      if (!path?.length) { unresolved++; continue; }
      const cur = sup.product.category;
      const vague = cur.nameKa === FALLBACK || cur.parentId === null;
      if (!all && !vague) { kept++; continue; }
      const next = await resolveCategoryId(path);
      const nextCat = await db.category.findUnique({ where: { id: next } });
      if (!nextCat || nextCat.nameKa === FALLBACK || next === cur.id) { kept++; continue; }
      const key = `${cur.nameKa} → ${nextCat.nameKa}`;
      moves.set(key, (moves.get(key) ?? 0) + 1);
      changed++;
      if (apply) await db.product.update({ where: { id: sup.productId }, data: { categoryId: next } });
    }
  }
  for (const [k, n] of [...moves].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${k}`);
  console.log(`\n${apply ? "შეიცვალა" : "შეიცვლებოდა"}: ${changed}, უცვლელი: ${kept}, გზა არ აქვს: ${unresolved}${apply ? "" : "\n(--apply ჩასაწერად)"}`);
  await db.$disconnect();
})();
