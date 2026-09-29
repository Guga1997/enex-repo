/**
 * Bluetti-ის წყარო Excel-იდან MUK-ზე გადაყვანა.
 *
 * ერთი და იგივე პოზიციები ორივე მიმწოდებელს ჰქონდა (SKU ემთხვევა), ამიტომ
 * პროდუქტები რჩება — უბრალოდ Excel-ის მიწოდება ეხსნება და ფასი/ნაშთი MUK-ს
 * მიჰყვება. Excel-ის ნუსხიდან BLUETTI ფურცელი ითიშება, რომ სინქმა არ დააბრუნოს.
 *
 *   npx tsx scripts/bluetti-source-muk.ts          — აჩვენებს
 *   npx tsx scripts/bluetti-source-muk.ts --write  — შეასრულებს
 */
import { db } from "../src/lib/db";
import { Pricer, repriceProduct } from "../src/lib/suppliers/pricing";
import { rollupStock } from "../src/lib/suppliers";

const write = process.argv.includes("--write");

(async () => {
  const excel = await db.supplier.findFirst({ where: { name: { startsWith: "Delta" } } });
  const muk = await db.supplier.findFirst({ where: { slug: "muk" } });
  if (!excel || !muk) {
    console.log("მიმწოდებელი ვერ მოიძებნა");
    return;
  }

  const bluetti = await db.product.findMany({
    where: { brand: { name: "Bluetti" } },
    select: {
      id: true, sku: true, nameKa: true, stockQty: true, price: true,
      supplies: { select: { id: true, supplierId: true, cost: true, qty: true } },
    },
    orderBy: { sku: "asc" },
  });

  const drop: string[] = [];
  console.log(`Bluetti: ${bluetti.length} პოზიცია\n`);
  for (const p of bluetti) {
    const fromExcel = p.supplies.find((s) => s.supplierId === excel.id);
    const fromMuk = p.supplies.find((s) => s.supplierId === muk.id);
    if (!fromExcel) continue;

    if (!fromMuk) {
      console.log(`  ⚠ ${p.sku.padEnd(20)} MUK-ს არ აქვს — Excel-ის მიწოდება რჩება`);
      continue;
    }
    console.log(
      `  ${p.sku.padEnd(20)} ნაშთი ${fromExcel.qty} (Excel) → ${fromMuk.qty} (MUK),` +
        ` თვითღ. ${fromExcel.cost} → ${fromMuk.cost}`
    );
    drop.push(fromExcel.id);
  }

  if (!write) {
    console.log(`\n— მხოლოდ ჩვენება. --write მოხსნის ${drop.length} მიწოდებას და გამორთავს BLUETTI ფურცელს`);
    await db.$disconnect();
    return;
  }

  await db.productSupply.deleteMany({ where: { id: { in: drop } } });

  // ნუსხაში BLUETTI ფურცელი აღარ გვჭირდება — DELTA რჩება
  if (excel.fieldMap) {
    const map = JSON.parse(excel.fieldMap) as { sheets?: Record<string, unknown> };
    if (map.sheets?.BLUETTI) {
      delete map.sheets.BLUETTI;
      await db.supplier.update({ where: { id: excel.id }, data: { fieldMap: JSON.stringify(map, null, 1) } });
      console.log("\n✓ BLUETTI ფურცელი ნუსხიდან მოიხსნა");
    }
  }

  const pricer = await Pricer.load();
  for (const p of bluetti) {
    await rollupStock(p.id);
    await repriceProduct(p.id, pricer);
  }

  console.log(`✓ მოიხსნა ${drop.length} მიწოდება, ფასი და ნაშთი გადაითვალა`);
  await db.$disconnect();
})();
