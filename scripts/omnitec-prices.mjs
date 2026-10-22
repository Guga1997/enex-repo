#!/usr/bin/env node
/**
 * Omnitec-ის ფასების კორექცია PDF ნუსხიდან არსებულ Excel-ში.
 *
 *   node scripts/omnitec-prices.mjs "path/to/Price List.pdf"          — ნახვა
 *   node scripts/omnitec-prices.mjs "path/to/Price List.pdf" --write  — ჩაწერა
 *
 * ფაილს თავიდან არ ვქმნით: Excel-ის კოდები (Code სვეტი) პროდუქტის
 * იდენტიფიკატორია — ახალი კოდი ახალ პროდუქტს შექმნიდა და კატალოგი
 * გაორმაგდებოდა. ამიტომ მხოლოდ `Price EUR` სვეტს ვასწორებთ, სტრიქონების
 * შესაბამისობას კი დასახელების ინგლისურ ნაწილზე ვპოულობთ.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const XLSX = createRequire(import.meta.url)("xlsx");

const SHEET = path.join(process.cwd(), "data", "pricelists", "omnitec.xlsx");
const pdf = process.argv[2];
const WRITE = process.argv.includes("--write");
if (!pdf) {
  console.log('გამოყენება: node scripts/omnitec-prices.mjs "ფაილი.pdf" [--write]');
  process.exit(1);
}

/* ------------------------------ PDF → ფასები ------------------------------ */

const text = execFileSync("pdftotext", ["-table", "-enc", "UTF-8", pdf, "-"], {
  maxBuffer: 1 << 28,
}).toString("utf8");

const tidy = (s) => s.replace(/\s{2,}/g, " ").trim();

/** სტრიქონის ბოლოს ფასი: „195.16€“ ან „1.234,56€“ */
function priceOf(line) {
  const m = line.match(/([\d][\d.,]*)\s*€\s*$/);
  if (!m) return null;
  const raw = m[1];
  // ევროპული ფორმატი: წერტილი ათასებია, მძიმე ათწილადი
  const n = /,\d{1,2}$/.test(raw)
    ? Number(raw.replace(/\./g, "").replace(",", "."))
    : Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? { price: n, head: line.slice(0, m.index) } : null;
}

const rows = [];
for (const line of text.split(/\r?\n/)) {
  const p = priceOf(line);
  if (!p) continue;
  const cells = p.head.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
  if (!cells.length) continue;
  rows.push({ cells, text: tidy(p.head), price: p.price });
}
console.log(`PDF-ში ფასიანი სტრიქონი: ${rows.length}`);

/* ------------------------------ შესაბამისობა ------------------------------ */

/** შედარებისთვის: მხოლოდ ასო-ციფრები, ქვედა რეგისტრში */
const key = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Excel-ის ქართული დასახელებიდან ინგლისური ნაწილი — ბოლო ორი „—“ სეგმენტი */
function englishPart(name) {
  const parts = String(name).split("—").map((s) => s.trim()).filter(Boolean);
  return parts.slice(-2).join(" ");
}

const wb = XLSX.readFile(SHEET);
let total = 0;
let matched = 0;
const changes = [];
const misses = [];

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  for (let r = 1; r < aoa.length; r++) {
    const [code, name, price] = aoa[r];
    if (!code && !name) continue;
    total++;

    const want = key(englishPart(name));
    const wantCode = key(code);

    // ჯერ კოდით (971174/5 და მისთანები PDF-შიც პირდაპირ წერია), მერე ტექსტით
    let hit =
      rows.find((x) => x.cells.some((c) => key(c) === wantCode && wantCode.length > 3)) ||
      rows.find((x) => key(x.text) === want) ||
      rows.find((x) => want.length > 8 && key(x.text).includes(want)) ||
      rows.find((x) => want.length > 8 && want.includes(key(x.text)) && key(x.text).length > 8);

    if (!hit) {
      misses.push({ sheetName, row: r + 1, code, name: tidy(String(name)).slice(0, 60), price });
      continue;
    }
    matched++;
    if (Math.abs(hit.price - Number(price)) > 0.005) {
      changes.push({ sheetName, row: r + 1, code, name: tidy(String(name)).slice(0, 52), from: Number(price), to: hit.price, ws, r });
    }
  }
}

// ნუსხა ერთიანად გაძვირდა — ტიპური კოეფიციენტი სიმართლის საზომია.
// ვინც მას ამოვარდა, სავარაუდოდ არასწორ სტრიქონს დაემთხვა.
const ratios = changes.filter((c) => c.from > 0).map((c) => Math.round((c.to / c.from) * 100) / 100);
const tally = new Map();
for (const r of ratios) tally.set(r, (tally.get(r) ?? 0) + 1);
const modal = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
const suspect = changes.filter((c) => c.from > 0 && Math.abs(c.to / c.from - modal[0]) > 0.01);
const safe = changes.filter((c) => !suspect.includes(c));

console.log(`Excel-ის სტრიქონი: ${total} | დაემთხვა: ${matched} | ფასი იცვლება: ${changes.length}`);
console.log(`ტიპური კოეფიციენტი: ×${modal[0]} (${modal[1]} სტრიქონი) | ეჭვქვეშ: ${suspect.length}\n`);

if (WRITE) for (const c of safe) c.ws[XLSX.utils.encode_cell({ r: c.r, c: 2 })] = { t: "n", v: c.to };

const by = {};
for (const c of safe) (by[c.sheetName] = by[c.sheetName] || []).push(c);
for (const s of Object.keys(by)) {
  console.log(`### ${s} — ${by[s].length}`);
  for (const c of by[s].slice(0, 6)) {
    const pct = c.from > 0 ? ((c.to / c.from - 1) * 100).toFixed(1) + "%" : "—";
    console.log(`   ${String(c.from).padStart(8)} → ${String(c.to).padStart(8)}  (${pct.padStart(7)})  ${c.name}`);
  }
  if (by[s].length > 6) console.log(`   … კიდევ ${by[s].length - 6}`);
}

if (suspect.length) {
  console.log("\n⚠ ეჭვქვეშ — არ ჩაიწერება, არასწორ სტრიქონს დაემთხვა:");
  for (const c of suspect) console.log(`   ${String(c.from).padStart(8)} → ${String(c.to).padStart(8)}  ${c.name}`);
}

if (misses.length) {
  console.log(`\nვერ დაემთხვა: ${misses.length}`);
  for (const m of misses.slice(0, 20)) console.log(`   ${m.sheetName.padEnd(16)} ${String(m.price).padStart(7)}  ${m.name}`);
  if (misses.length > 20) console.log(`   … კიდევ ${misses.length - 20}`);
}

if (WRITE) {
  XLSX.writeFile(wb, SHEET);
  console.log(`\n✓ ჩაიწერა: ${SHEET}`);
} else {
  console.log("\nცვლილება არ შესულა. ჩასაწერად: --write");
}
