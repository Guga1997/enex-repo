/**
 * არასწორად გაერთიანებული პროდუქტების დაშლა.
 *
 *   npx tsx scripts/split-merged-supplies.ts          — ნახვა
 *   npx tsx scripts/split-merged-supplies.ts --write  — დაშლა და სინქი
 *
 * სინქი პროდუქტს მოდელითაც ამთხვევდა, MUK კი ზოგად მოდელს წერს („bag“), ამიტომ
 * ერთი მიმწოდებლის სხვადასხვა კოდი ერთ პროდუქტზე ჯდებოდა — ყველაზე იაფის ფასით
 * და ყველას ნაშთის ჯამით. იმავე მიმწოდებლის ორი კოდი ორი სხვადასხვა ნივთია.
 *
 * ვტოვებთ იმ მიწოდებას, რომლის კოდი პროდუქტის კოდს ემთხვევა (ან პირველს), დანარჩენს
 * ვხსნით და მიმწოდებლის სინქს ვუშვებთ — ის მათ ცალკე პროდუქტებად შექმნის
 * (ახალი პროდუქტი გამორთული მოდის, გამოქვეყნება ადმინში).
 */
import { db } from "../src/lib/db";
import { rollupStock, syncSupplier } from "../src/lib/suppliers";
import { repriceProduct } from "../src/lib/suppliers/pricing";

const WRITE = process.argv.includes("--write");

(async () => {
  const supplies = await db.productSupply.findMany({
    select: {
      id: true, supplierId: true, supplierSku: true, cost: true,
      product: { select: { id: true, sku: true, nameKa: true, price: true } },
      supplier: { select: { slug: true } },
    },
    orderBy: { id: "asc" },
  });

  const groups = new Map<string, typeof supplies>();
  for (const s of supplies) {
    const k = `${s.product.id}:${s.supplierId}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }

  const detach: string[] = [];
  const touched = new Set<string>();
  const suppliersToSync = new Set<string>();

  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const p = g[0].product;
    const keep = g.find((s) => s.supplierSku === p.sku) ?? g[0];
    const extra = g.filter((s) => s !== keep);
    console.log(`${p.sku.padEnd(14)} ${p.nameKa.slice(0, 40).padEnd(41)} ${String(p.price).padStart(9)}₾  ← დატოვე ${keep.supplierSku}, მოხსენი ${extra.length}: ${extra.map((e) => e.supplierSku).slice(0, 6).join(", ")}${extra.length > 6 ? " …" : ""}`);
    detach.push(...extra.map((e) => e.id));
    touched.add(p.id);
    suppliersToSync.add(g[0].supplierId);
  }

  console.log(`\nპროდუქტი: ${touched.size} | მოსახსნელი მიწოდება: ${detach.length}`);
  if (!WRITE) {
    console.log("ცვლილება არ შესულა. გასაშვებად: --write");
    await db.$disconnect();
    return;
  }

  await db.productSupply.deleteMany({ where: { id: { in: detach } } });
  for (const id of touched) {
    await rollupStock(id);
    await repriceProduct(id);
  }
  console.log("✓ მოიხსნა, ფასი და ნაშთი გადაითვალა");

  for (const id of suppliersToSync) {
    const r = await syncSupplier(id);
    const s = await db.supplier.findUnique({ where: { id }, select: { slug: true } });
    console.log(`სინქი ${s?.slug}: +${r.created} ახალი, ${r.updated} განახლდა, ${r.failed} ჩავარდა`);
  }
  await db.$disconnect();
})();
