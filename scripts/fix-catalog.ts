/**
 * აუდიტით ნაპოვნი შეცდომების გასწორება.
 *
 *   npx tsx scripts/fix-catalog.ts          — აჩვენებს რას გააკეთებდა
 *   npx tsx scripts/fix-catalog.ts --write  — ჩაწერს
 *
 * რას აკეთებს:
 *  1. უფასო პროდუქტს (ფასი ≤ 0) გამორთავს — საიტზე „0 ₾-ად“ არ უნდა ჩანდეს.
 *  2. დასახელებებში ორმაგ ღარს კრებს.
 *  3. „+“ / „-“ მახასიათებლებს „კი“ / „არა“-დ თარგმნის (ფილტრშიც ასე ჩანს).
 *  4. ერთი მნიშვნელობის სხვადასხვა ჩაწერას (1.5KG / 1.5kg) ყველაზე ხშირზე უსწორებს.
 *  5. ცარიელ კატეგორიას გამორთავს, რომ მენიუში ცარიელი გვერდი არ იყოს.
 */
import { db } from "../src/lib/db";

const write = process.argv.includes("--write");
const say = (s: string) => console.log(s);

(async () => {
  // 1 — უფასო პროდუქტები
  const free = await db.product.findMany({
    where: { isActive: true, price: { lte: 0 } },
    select: { id: true, sku: true, nameKa: true },
  });
  say(`\n### ფასის გარეშე — ${free.length} გამოირთვება`);
  for (const p of free.slice(0, 10)) say(`  ${p.sku}: ${p.nameKa.slice(0, 50)}`);
  if (write && free.length) {
    await db.product.updateMany({ where: { id: { in: free.map((p) => p.id) } }, data: { isActive: false } });
  }

  // 1b — თვითღირებულებაზე ორჯერ იაფი: ფასი ან დამთხვევა არასწორია
  const cheap = await db.product.findMany({
    where: { isActive: true, cost: { gt: 0 }, price: { gt: 0 } },
    select: { id: true, sku: true, nameKa: true, price: true, cost: true },
  });
  const losing = cheap.filter((p) => p.price < p.cost! * 0.5);
  say(`
### თვითღირებულებაზე ორჯერ იაფი — ${losing.length} გამოირთვება`);
  for (const p of losing) say(`  ${p.sku}: ფასი ${p.price} ₾, თვითღირებულება ${p.cost} ₾ — ${p.nameKa.slice(0, 40)}`);
  if (write && losing.length) {
    await db.product.updateMany({ where: { id: { in: losing.map((p) => p.id) } }, data: { isActive: false } });
  }

  // 2 — ორმაგი ღარები დასახელებებში
  const named = await db.product.findMany({
    select: { id: true, sku: true, nameKa: true, nameEn: true, nameRu: true },
  });
  const tidy = (v: string | null) => (v === null ? null : v.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim());
  const dirty = named.filter(
    (p) => tidy(p.nameKa) !== p.nameKa || tidy(p.nameEn) !== p.nameEn || tidy(p.nameRu) !== p.nameRu
  );
  say(`\n### დასახელებაში ზედმეტი ღარი — ${dirty.length}`);
  for (const p of dirty.slice(0, 5)) say(`  ${p.sku}: „${p.nameKa}“ → „${tidy(p.nameKa)}“`);
  if (write) {
    for (const p of dirty) {
      await db.product.update({
        where: { id: p.id },
        data: { nameKa: tidy(p.nameKa)!, nameEn: tidy(p.nameEn), nameRu: tidy(p.nameRu) },
      });
    }
  }

  // 3 — „+“ / „-“ → „კი“ / „არა“
  const flags = await db.productAttribute.findMany({
    where: { value: { in: ["+", "-", "–", "—"] } },
    select: { id: true, value: true },
  });
  const plus = flags.filter((f) => f.value === "+").length;
  say(`\n### „+“/„-“ მახასიათებელი — ${flags.length} (მათგან „+“: ${plus})`);
  if (write) {
    for (const f of flags) {
      await db.productAttribute.update({
        where: { id: f.id },
        data: { value: f.value === "+" ? "კი" : "არა" },
      });
    }
  }

  // 4 — ერთი მნიშვნელობის სხვადასხვა ჩაწერა
  const attrs = await db.productAttribute.findMany({ select: { id: true, name: true, value: true } });
  const groups = new Map<string, { id: string; value: string }[]>();
  for (const a of attrs) {
    const key = `${a.name}|${a.value.toLowerCase().replace(/\s/g, "")}`;
    groups.set(key, [...(groups.get(key) ?? []), { id: a.id, value: a.value }]);
  }
  let merged = 0;
  say(`\n### ერთი მნიშვნელობა რამდენიმე სახით`);
  for (const [key, list] of groups) {
    const variants = [...new Set(list.map((l) => l.value))];
    if (variants.length < 2) continue;
    // ყველაზე ხშირი ჩაწერა იმარჯვებს
    const freq = new Map<string, number>();
    for (const l of list) freq.set(l.value, (freq.get(l.value) ?? 0) + 1);
    const best = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    say(`  ${key.split("|")[0]}: ${variants.join(" / ")} → „${best}“`);
    for (const l of list) {
      if (l.value === best) continue;
      merged++;
      if (write) await db.productAttribute.update({ where: { id: l.id }, data: { value: best } });
    }
  }
  say(`  სულ ${merged} ჩანაწერი`);

  // 5 — ცარიელი კატეგორიები
  const cats = await db.category.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, nameKa: true, _count: { select: { products: true, children: true } } },
  });
  const empty = cats.filter((c) => c._count.products === 0 && c._count.children === 0);
  say(`\n### ცარიელი კატეგორია — ${empty.length} გამოირთვება`);
  for (const c of empty) say(`  ${c.slug}: ${c.nameKa}`);
  if (write && empty.length) {
    await db.category.updateMany({ where: { id: { in: empty.map((c) => c.id) } }, data: { isActive: false } });
  }

  say(write ? "\n✓ ჩაწერილია" : "\n— მხოლოდ ჩვენება (--write გჭირდება)");
  await db.$disconnect();
})();
