/**
 * გენერატორების სიმძლავრის შესწორება.
 *
 * datasheet-ის PDF-ში სიმძლავრე ორ რიცხვად ეწერა („1250 / 1125 kVA“) და
 * ამომღებმა მხოლოდ პირველი ციფრები აიღო — ბაზაში „1 kVA“ და „250 kVA“ ჩაიწერა.
 * სწორი მნიშვნელობა კილოვატებიდან გამოითვლება: kVA = kW / cos φ.
 *
 *   npx tsx scripts/fix-generator-power.ts          — მხოლოდ აჩვენებს
 *   npx tsx scripts/fix-generator-power.ts --write  — ჩაწერს ბაზაშიც და enrich-ფაილშიც
 */
import { readFileSync, writeFileSync } from "fs";
import { db } from "../src/lib/db";

const write = process.argv.includes("--write");
const ESP = "Stand-by სიმძლავრე (ESP)";
const PRP = "Prime სიმძლავრე (PRP)";
const KW = "სიმძლავრე kW (ESP / PRP)";
const PF = "სიმძლავრის კოეფიციენტი";

const num = (v: string | undefined) => {
  const m = v?.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

(async () => {
  const products = await db.product.findMany({
    where: { attributes: { some: { name: KW } } },
    select: { id: true, sku: true, nameKa: true, attributes: { select: { id: true, name: true, value: true } } },
  });

  let fixed = 0, skipped = 0;
  const byModel = new Map<string, { esp: string; prp: string }>();

  for (const p of products) {
    const get = (n: string) => p.attributes.find((a) => a.name === n)?.value;
    const kw = get(KW)?.split("/") ?? [];
    const espKw = num(kw[0]);
    const prpKw = num(kw[1]);
    const pf = num(get(PF)) ?? 0.8;
    if (espKw === null || prpKw === null || !pf) { skipped++; continue; }

    // სახელში მითითებული kVA ჭეშმარიტების წყაროა (Excel-ის ნუსხიდან მოდის)
    const named = num(p.nameKa.match(/—\s*(\d+(?:[.,]\d+)?)\s*kVA/)?.[1]);
    const esp = named ?? Math.round(espKw / pf);
    const calcPrp = Math.round(prpKw / pf);
    // Prime ყოველთვის Stand-by-ის 70–100%-ია; მიღმა რიცხვი PDF-ის ნაგავია
    const plausible = (v: number | null) => v !== null && v >= esp * 0.7 && v <= esp;
    const prp = plausible(calcPrp) ? calcPrp : null;

    const want: Record<string, string> = { [ESP]: `${esp} kVA` };
    if (prp !== null) want[PRP] = `${prp} kVA`;

    // Prime ვერ გამოვთვალეთ და ჩაწერილიც უაზროა — ასეთი მახასიათებელი ზედმეტია
    if (prp === null && !plausible(num(get(PRP)))) {
      const junk = p.attributes.find((x) => x.name === PRP);
      if (junk) {
        console.log(`  ✗ ${p.sku}: Prime ${junk.value} არაა დამაჯერებელი — წავშალე`);
        if (write) await db.productAttribute.delete({ where: { id: junk.id } });
      }
    }
    const wrong = p.attributes.filter((a) => want[a.name] && a.value !== want[a.name]);
    if (!wrong.length) continue;

    console.log(`  ${p.sku}: ${wrong.map((a) => `${a.name}: ${a.value} → ${want[a.name]}`).join(", ")}`);
    if (write) {
      for (const a of wrong) await db.productAttribute.update({ where: { id: a.id }, data: { value: want[a.name] } });
    }
    byModel.set(p.sku, { esp: want[ESP], prp: want[PRP] });
    fixed++;
  }

  // enrich-ფაილიც, რომ სინქმა ძველი მნიშვნელობა აღარ დააბრუნოს
  if (write) {
    const path = "data/generators-enrich.json";
    const enrich = JSON.parse(readFileSync(path, "utf8")) as Record<string, { attrs?: Record<string, string> }>;
    let touched = 0;
    for (const [key, entry] of Object.entries(enrich)) {
      const attrs = entry.attrs;
      if (!attrs?.[KW]) continue;
      const kw = attrs[KW].split("/");
      const espKw = num(kw[0]);
      const prpKw = num(kw[1]);
      const pf = num(attrs[PF]) ?? 0.8;
      if (espKw === null || prpKw === null || !pf) continue;
      const esp = Math.round(espKw / pf);
      const prp = Math.round(prpKw / pf);
      const next: Record<string, string> = { [ESP]: `${esp} kVA` };
      if (prp >= esp * 0.7 && prp <= esp) next[PRP] = `${prp} kVA`;
      else delete attrs[PRP];
      if (attrs[ESP] === next[ESP] && attrs[PRP] === next[PRP]) continue;
      Object.assign(attrs, next);
      touched++;
      void key;
    }
    writeFileSync(path, JSON.stringify(enrich, null, 1));
    console.log(`enrich-ფაილი: ${touched} ჩანაწერი`);
  }

  console.log(`\nპროდუქტი ${products.length}: ${fixed} შესწორდა, ${skipped} გამოვტოვე${write ? "" : " (მხოლოდ ჩვენება — --write გჭირდება)"}`);
  await db.$disconnect();
})();
