/**
 * ფასთა ნუსხების გასწორება წყარო PDF-ებთან შედარების შემდეგ (2026-11-11).
 *
 *   npx tsx scripts/fix-pricelists.ts            — მშრალი გაშვება: რას შეცვლიდა
 *   npx tsx scripts/fix-pricelists.ts --write    — ჩაწერა + Omnitec/Dahua სინქი
 *
 * რა აღმოჩნდა შედარებისას:
 *  • Omnitec („Price List 2026 - Omnitec - adjusted.pdf“): 10 სტრიქონს ძველი, კორექციამდელი ფასი
 *    ედო (4 მინიბარი, 3 საკეტი, 3 პროგრამა) — ავტომატურმა შედარებამ ისინი ვერ იპოვა;
 *    ორი კოდი (973000FEE, 971028) ორ-ორ სხვადასხვა ფასიან სტრიქონზე ეწერა და ბოლო იმარჯვებდა
 *    („წლიური გადასახადი სასტუმროზე“ 188.61 € მოწყობილობის 4 €-ად ჩანდა).
 *  • Dahua (უსადენო სიგნალიზაციის ნუსხა): 8 სტრიქონზე მოდელის კოდი ერთი რიგით იყო აცდენილი —
 *    აღწერა, არტიკული და ფასი სწორია, მოდელი კი მეზობლის ეწერა (ARD323 თეთრს ARD333 შავის ფასი ჰქონდა).
 *  • სეიფის/მინიბარის აქსესუარებს „სასტუმროს სეიფი — …“ ერქვა და 19 ₾-იან „სეიფად“ ჩანდა.
 *
 * გამეორება უსაფრთხოა: უკვე გასწორებულს მეორედ არ ეხება.
 */
import { existsSync } from "fs";
import * as XLSX from "xlsx";
import { db } from "../src/lib/db";
import { syncSupplier } from "../src/lib/suppliers";
import { pricelistPath } from "../src/lib/suppliers/spreadsheet";

const WRITE = process.argv.includes("--write");
const log = (s: string) => console.log(s);

type Row = (string | number | null | undefined)[];
type Patch = { code?: string; name?: string; price?: number };
/** პირობა სტრიქონზე → ცვლილება; code+price ერთად დუბლ კოდებს არჩევს */
type Rule = { sheet: string; match: (r: Row) => boolean; patch: Patch | ((r: Row) => Patch); note: string };

function patchWorkbook(file: string, rules: Rule[]): number {
  if (!existsSync(file)) {
    log(`⚠ ფაილი არ არის: ${file}`);
    return 0;
  }
  const wb = XLSX.readFile(file);
  let changed = 0;
  for (const rule of rules) {
    const ws = wb.Sheets[rule.sheet];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { header: 1 });
    let hit = false;
    for (const r of rows.slice(1)) {
      if (!rule.match(r)) continue;
      hit = true;
      const p = typeof rule.patch === "function" ? rule.patch(r) : rule.patch;
      const before = `${r[0]} | ${String(r[1]).slice(0, 46)} | ${r[2]}`;
      let diff = false;
      if (p.code !== undefined && r[0] !== p.code) { r[0] = p.code; diff = true; }
      if (p.name !== undefined && r[1] !== p.name) { r[1] = p.name; diff = true; }
      if (p.price !== undefined && Number(r[2]) !== p.price) { r[2] = p.price; diff = true; }
      if (diff) {
        changed++;
        log(`  ${rule.sheet}: ${before}  →  ${r[0]} | ${String(r[1]).slice(0, 46)} | ${r[2]}   (${rule.note})`);
      }
    }
    if (hit) wb.Sheets[rule.sheet] = XLSX.utils.aoa_to_sheet(rows as unknown[][]);
  }
  if (changed && WRITE) XLSX.writeFile(wb, file);
  return changed;
}

const code = (c: string) => (r: Row) => String(r[0] ?? "").trim() === c;
const codeAt = (c: string, price: number[]) => (r: Row) => String(r[0] ?? "").trim() === c && price.includes(Number(r[2]));
const tail = (r: Row) => String(r[1] ?? "").split("—").slice(1).join("—").trim();

/* ───────────────────────────── Omnitec ───────────────────────────── */

const PDF = "adjusted PDF";
const OMNITEC: Rule[] = [
  { sheet: "Minibars", match: code("193004T"), patch: { price: 191.23 }, note: PDF },
  { sheet: "Minibars", match: code("93006T"), patch: { price: 200.4 }, note: PDF },
  { sheet: "Minibars", match: code("OMN-ARCO"), patch: { price: 619.54 }, note: PDF },
  { sheet: "Minibars", match: code("93362"), patch: { price: 182.06 }, note: PDF },
  { sheet: "Locks", match: code("OMN-ACCESS-ENABLED-VIA-NUMERIC-CODE"), patch: { price: 32.75 }, note: PDF },
  { sheet: "Locks", match: code("OMN-EVO"), patch: { price: 216.12 }, note: PDF },
  { sheet: "Locks", match: code("OMN-ADAPTABLE-TO-EXISTING-MORTISE-LOCK"), patch: { price: 170.27 }, note: PDF },
  { sheet: "Software", match: code("OMN-PORTABLE-UNIT-FOR-SET-UP-AUDIT9603"), patch: { price: 510.82 }, note: PDF },
  {
    sheet: "Software", match: code("OMN-CONCEPT"), note: "სათაურის სტრიქონი ფასად იყო წაკითხული",
    patch: { price: 10.48, name: "პროგრამული უზრუნველყოფა — Option Online: Annual fee per device + 1 GW free for every 4 devices" },
  },
  {
    sheet: "Software", match: code("973000FEEOW"), note: "სახელი შუაში იყო გაწყვეტილი",
    patch: { name: "პროგრამული უზრუნველყოფა — Option Online + Webkey: Annual fee per device + 1 GW free for every 4 devices" },
  },
  // ერთი კოდი ორ სტრიქონზე: სასტუმროზე 188.61 € რჩება, მოწყობილობაზე ცალკე კოდი
  { sheet: "Software", match: codeAt("973000FEE", [4, 5.24]), patch: { code: "973000FEE-DEV", price: 5.24 }, note: "დუბლი კოდი" },
  {
    sheet: "Cards", match: codeAt("971028", [0.27, 0.35]), note: PDF,
    patch: { price: 0.35, name: "ბარათი / სამაჯური — CARD CUSTOMIZATION (600–1000 ცალი)" },
  },
  {
    sheet: "Cards", match: codeAt("971028", [0.15, 0.2]), note: "დუბლი კოდი",
    patch: { code: "971028-1000", price: 0.2, name: "ბარათი / სამაჯური — CARD CUSTOMIZATION (1000+ ცალი)" },
  },
  // აქსესუარი სეიფად/მინიბარად არ უნდა ჩანდეს
  ...["957206", "91601", "91602", "91609", "979901", "91333C", "957208"].map((c) => ({
    sheet: "Safes", match: code(c), note: "აქსესუარია",
    patch: (r: Row) => ({ name: `სეიფის აქსესუარი — ${tail(r)}` }),
  })),
  { sheet: "Minibars", match: code("958210"), patch: { name: "მინიბარის აქსესუარი — PURE T/N — SLIDING GUIDE" }, note: "აქსესუარია" },
];

/** ბაზაში სახელის გასწორება (სინქი არსებულ პროდუქტს სახელს არ უცვლის) */
const OMNITEC_NAMES: { sku: string; ka: string; en: string; ru: string }[] = [
  ...[
    ["957206", "SWITCH ON/ OFF LOCK (REST OF MODELS)"],
    ["91601", "INNER MULTI-AREA SOCKET"],
    ["91602", "ELECTRIC POWER SOURCE"],
    ["91609", "INNER USB & MULTI-AREA SOCKET"],
    ["979901", "NOBO SAFE PORTABLE UNIT FOR SET UP/AUDIT"],
    ["91333C", "NOBO CARD OPENNING OPTION"],
    ["957208", "SWITCH ON/ OFF LOCK (SAFEGUARD)"],
  ].map(([sku, t]) => ({ sku, ka: `სეიფის აქსესუარი — ${t}`, en: `Safe accessory — ${t}`, ru: `Аксессуар для сейфа — ${t}` })),
  { sku: "958210", ka: "მინიბარის აქსესუარი — PURE T/N — SLIDING GUIDE", en: "Minibar accessory — PURE T/N — SLIDING GUIDE", ru: "Аксессуар для мини-бара — PURE T/N — SLIDING GUIDE" },
  {
    sku: "OMN-CONCEPT",
    ka: "პროგრამული უზრუნველყოფა — Option Online: Annual fee per device + 1 GW free for every 4 devices",
    en: "Software — Option Online: Annual fee per device + 1 GW free for every 4 devices",
    ru: "Программное обеспечение — Option Online: Annual fee per device + 1 GW free for every 4 devices",
  },
  {
    sku: "973000FEEOW",
    ka: "პროგრამული უზრუნველყოფა — Option Online + Webkey: Annual fee per device + 1 GW free for every 4 devices",
    en: "Software — Option Online + Webkey: Annual fee per device + 1 GW free for every 4 devices",
    ru: "Программное обеспечение — Option Online + Webkey: Annual fee per device + 1 GW free for every 4 devices",
  },
  {
    sku: "971028",
    ka: "ბარათი / სამაჯური — CARD CUSTOMIZATION (600–1000 ცალი)",
    en: "Card / wristband — CARD CUSTOMIZATION (600–1000 pcs)",
    ru: "Карта / браслет — CARD CUSTOMIZATION (600–1000 шт.)",
  },
];
/** სინქი ახალ პროდუქტს გამორთულს ქმნის — ეს ორი არსებულის გაყოფაა, ამიტომ ირთვება */
const OMNITEC_NEW = ["973000FEE-DEV", "971028-1000"];

/* ───────────────────────────── Dahua ───────────────────────────── */

/** არტიკული (PDF-ის #58xxxx) → სწორი მოდელი; ამჟამინდელი (არასწორი) კოდი ბაზაში */
const DAHUA: { art: string; from: string; to: string }[] = [
  { art: "583010", from: "ARA24-W2(868)-B", to: "ARA24-W2(868)" },
  { art: "583009", from: "ARD821-W2(868)-KUY0", to: "ARA24-W2(868)-B" },
  { art: "583013", from: "ARD821-W2(868)-L229", to: "ARD821-W2(868)" },
  { art: "583016", from: "ARD333-W2(868S)-B", to: "ARD333-W2(868S)" },
  { art: "583017", from: "ARD323-W2(868)", to: "ARD333-W2(868S)-B" },
  { art: "583018", from: "ARD323-W2(868)-B", to: "ARD323-W2(868)" },
  { art: "583019", from: "ARD324-W2(868S)-N4Y2", to: "ARD323-W2(868)-B" },
  { art: "583020", from: "ARD324-W2(868S)-V4DO", to: "ARD324-W2(868S)" },
];
const relabel = (name: string | null, model: string) => (name ? name.replace(/^Dahua \S+ —/, `Dahua ${model} —`) : name);
const DAHUA_RULES: Rule[] = DAHUA.map((d) => ({
  sheet: "Wireless",
  match: (r: Row) => String(r[4] ?? "").trim() === d.art,
  patch: (r: Row) => ({ code: d.to, name: relabel(String(r[1] ?? ""), d.to) ?? undefined }),
  note: `არტიკული #${d.art}`,
}));

async function relabelDahua(supplierId: string) {
  // „ARD821-W2(868)-KUY0“ მხოლოდ გასწორებამდე არსებობს — მისი არქონა ნიშნავს, რომ უკვე გაკეთებულია
  const marker = await db.product.findUnique({ where: { sku: "ARD821-W2(868)-KUY0" }, select: { id: true } });
  if (!marker) return log("  ბაზა: მოდელის კოდები უკვე სწორია");
  type P = { id: string; nameKa: string; nameEn: string | null; nameRu: string | null };
  const rows: ((typeof DAHUA)[number] & { p: P })[] = [];
  for (const d of DAHUA) {
    const p = await db.product.findUnique({ where: { sku: d.from }, select: { id: true, nameKa: true, nameEn: true, nameRu: true } });
    if (!p) throw new Error(`Dahua: ${d.from} ბაზაში არ არის — ხელით გადასამოწმებელია`);
    rows.push({ ...d, p });
    log(`  ბაზა: ${d.from}  →  ${d.to}   | ${p.nameKa.slice(0, 60)}`);
  }
  const taken = await db.product.findMany({
    where: { sku: { in: DAHUA.map((d) => d.to) }, id: { notIn: rows.map((r) => r.p.id) } },
    select: { sku: true },
  });
  if (taken.length) throw new Error(`Dahua: კოდი უკვე სხვა პროდუქტს აქვს: ${taken.map((t) => t.sku).join(", ")}`);
  if (!WRITE) return;
  // კოდები ერთმანეთს ენაცვლება (A→B, B→C), sku კი უნიკალურია — ამიტომ ჯერ დროებითი სახელი
  await db.$transaction(async (tx) => {
    for (const r of rows) {
      await tx.product.update({ where: { id: r.p.id }, data: { sku: `RELABEL-${r.art}` } });
      await tx.productSupply.updateMany({ where: { productId: r.p.id, supplierId }, data: { supplierSku: `RELABEL-${r.art}` } });
    }
    for (const r of rows) {
      await tx.product.update({
        where: { id: r.p.id },
        data: { sku: r.to, model: r.to, nameKa: relabel(r.p.nameKa, r.to)!, nameEn: relabel(r.p.nameEn, r.to), nameRu: relabel(r.p.nameRu, r.to) },
      });
      await tx.productSupply.updateMany({ where: { productId: r.p.id, supplierId }, data: { supplierSku: r.to } });
    }
  });
}

/* ───────────────────────────── გაშვება ───────────────────────────── */

const WATCH = [
  "193004T", "93006T", "OMN-ARCO", "93362", "OMN-ACCESS-ENABLED-VIA-NUMERIC-CODE", "OMN-EVO",
  "OMN-ADAPTABLE-TO-EXISTING-MORTISE-LOCK", "OMN-PORTABLE-UNIT-FOR-SET-UP-AUDIT9603", "OMN-CONCEPT",
  "973000FEE", "973000FEE-DEV", "971028", "971028-1000", ...DAHUA.map((d) => d.to),
];
const prices = async () =>
  new Map((await db.product.findMany({ where: { sku: { in: WATCH } }, select: { sku: true, price: true } })).map((p) => [p.sku, p.price]));

(async () => {
  const [omnitec, dahua] = await Promise.all([
    db.supplier.findFirst({ where: { slug: "omnitec" } }),
    db.supplier.findFirst({ where: { adapter: "SPREADSHEET", name: { startsWith: "Dahua" } } }),
  ]);
  if (!omnitec || !dahua) throw new Error("Omnitec ან Dahua მიმწოდებელი ვერ მოიძებნა");
  const before = await prices();

  log("Dahua — მოდელის კოდები");
  await relabelDahua(dahua.id);
  const d = patchWorkbook(pricelistPath(dahua.slug), DAHUA_RULES);

  log("\nOmnitec — ფასები და სახელები");
  const o = patchWorkbook(pricelistPath(omnitec.slug), OMNITEC);
  for (const n of OMNITEC_NAMES) {
    const p = await db.product.findUnique({ where: { sku: n.sku }, select: { id: true, nameKa: true } });
    if (!p || p.nameKa === n.ka) continue;
    log(`  ბაზა: ${n.sku}: ${p.nameKa.slice(0, 50)}  →  ${n.ka.slice(0, 60)}`);
    if (WRITE) await db.product.update({ where: { id: p.id }, data: { nameKa: n.ka, nameEn: n.en, nameRu: n.ru } });
  }

  log(`\nნუსხებში ${WRITE ? "შეიცვალა" : "შეიცვლებოდა"}: Omnitec ${o}, Dahua ${d} სტრიქონი`);
  if (!WRITE) {
    log("(--write ჩასაწერად; ჩაწერის შემდეგ ორივე მიმწოდებელი მაშინვე სინქრონდება)");
    return db.$disconnect();
  }

  for (const s of [dahua, omnitec]) {
    const res = await syncSupplier(s.id);
    log(`სინქი ${s.name}: ${res.ok ? `+${res.created} ახალი, ${res.updated} განახლდა, ${res.failed} ჩავარდა` : `შეცდომა — ${res.message}`}`);
  }
  const on = await db.product.updateMany({ where: { sku: { in: OMNITEC_NEW }, isActive: false }, data: { isActive: true } });
  if (on.count) log(`ჩაირთო ${on.count} გაყოფილი პროდუქტი (${OMNITEC_NEW.join(", ")})`);

  const after = await prices();
  log("\nფასი ₾: იყო → არის");
  for (const sku of WATCH) {
    const a = before.get(sku), b = after.get(sku);
    if (a !== b) log(`  ${sku.padEnd(40)} ${a ?? "—"} → ${b ?? "—"}`);
  }
  await db.$disconnect();
})().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await db.$disconnect();
  process.exit(1);
});
