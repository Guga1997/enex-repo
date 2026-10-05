/**
 * MUK-ის XML-სა და ჩვენს ბაზას ადარებს — ნაშთი სად სხვაობს და რატომ.
 *
 *   npx tsx scripts/muk-diff.ts            — შეჯამება
 *   npx tsx scripts/muk-diff.ts 0231A562   — კონკრეტული კოდები დეტალურად
 *
 * სერვერზე უნდა გაეშვას: MUK-ის API IP-ით არის შეზღუდული.
 */
import { db } from "../src/lib/db";
import { resolveAdapter } from "../src/lib/suppliers";

const want = process.argv.slice(2).map((s) => s.toUpperCase());

(async () => {
  const s = await db.supplier.findUnique({ where: { slug: "muk" } });
  if (!s) throw new Error("muk მიმწოდებელი არ არის");

  const items = await resolveAdapter(s.adapter).fetchItems(s);
  const supplies = await db.productSupply.findMany({
    where: { supplierId: s.id },
    include: { product: { select: { id: true, sku: true, stockQty: true, reservedQty: true, stockStatus: true, isActive: true, nameKa: true, price: true } } },
  });
  const bySku = new Map(supplies.map((x) => [x.supplierSku.toUpperCase(), x]));

  console.log(`XML: ${items.length} პოზიცია | ბაზაში: ${supplies.length} მიწოდება`);

  const diff: string[] = [];
  let missing = 0;
  let qtyOff = 0;
  let statusOff = 0;

  for (const it of items) {
    const row = bySku.get(it.supplierSku.toUpperCase());
    if (!row) {
      missing++;
      if (want.length === 0 && missing <= 10) diff.push(`ბაზაში არ არის: ${it.supplierSku} — ${it.name.slice(0, 50)} (XML: ${it.qty} ც., ${it.status})`);
      continue;
    }
    const qDiff = row.qty !== it.qty;
    const sDiff = row.status !== it.status;
    if (qDiff) qtyOff++;
    if (sDiff) statusOff++;

    const show = want.length ? want.includes(it.supplierSku.toUpperCase()) : qDiff || sDiff;
    if (show && diff.length < 40) {
      diff.push(
        `${it.supplierSku}\n` +
          `   XML:      ${it.qty} ც. | ${it.status}\n` +
          `   მიწოდება: ${row.qty} ც. | ${row.status} | განახლდა ${row.updatedAt.toISOString().slice(0, 16)}\n` +
          `   პროდუქტი: ნაშთი ${row.product.stockQty} (დაჯავშნული ${row.product.reservedQty}) | ${row.product.stockStatus} | ${row.product.isActive ? "გამოქვეყნებული" : "დამალული"} | ${row.product.nameKa.slice(0, 45)}`
      );
    }
  }

  console.log(`\nსხვაობა: ნაშთი ${qtyOff}, სტატუსი ${statusOff}, ბაზაში არ არის ${missing}\n`);
  console.log(diff.join("\n") || "სხვაობა არ არის");

  // ბაზაშია, XML-ში აღარ — ასეთებს სინქი ვერ ანულებს
  const inXml = new Set(items.map((i) => i.supplierSku.toUpperCase()));
  const stale = supplies.filter((x) => !inXml.has(x.supplierSku.toUpperCase()));
  if (stale.length) {
    console.log(`\nXML-ში აღარ არის, ბაზაში კი დარჩა: ${stale.length}`);
    for (const x of stale.slice(0, 15)) {
      console.log(`   ${x.supplierSku}: ${x.qty} ც. | ${x.status} | პროდუქტის ნაშთი ${x.product.stockQty} | ${x.product.isActive ? "გამოქვეყნებული" : "დამალული"}`);
    }
  }

  await db.$disconnect();
})();
