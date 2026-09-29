/**
 * PDF ფასთა ნუსხა → Excel, რომელსაც SPREADSHEET ადაპტერი კითხულობს.
 *
 *   node scripts/pdf-pricelist.mjs
 *
 * მიმწოდებელი ფასებს PDF-ით გვიგზავნის. ტექსტს xpdf-ის `pdftotext -table`
 * აღადგენს სვეტებად, აქ კი მწკრივებად იშლება: მოდელი, არტიკული, აღწერა, ფასი.
 * შედეგი — data/pricelists/<slug>.xlsx, იმავე სახით, როგორც სხვა Excel-ები.
 *
 * ახალი ნუსხის მოსვლისას: PDF-ები Downloads-ში ჩააგდე, SOURCES-ში გზა შეასწორე
 * და ხელახლა გაუშვი — შემდეგ ადმინიდან სინქი.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const HOME = process.env.USERPROFILE || process.env.HOME;
const DL = path.join(HOME, "Downloads");
const OUT = path.join(process.cwd(), "data", "pricelists");

/** ფურცლის სახელი → PDF და პარსერი */
const SOURCES = {
  dahua: {
    Fire: { file: "პრაისი ლისტი. სახანძრო სამისამართო სიგნალიზაციის სისტემა - Dahua (04.2026).pdf", kind: "dahua" },
    Wireless: { file: "პრაისი ლისტი. უსადენო დაცვითი სიგნალიზაცია - Dahua (04.2026).pdf", kind: "dahua" },
    Voice: { file: "პრაის ლისტი (Dahua) —მეხანძრის ტელეფონია, საჯარო მაუწყებლობის და ევაკუაციის სისტემა (02.26)[1].pdf", kind: "dahua", sections: true },
  },
  ajax: {
    Ajax: { file: "Ajax_Price_List_GE.pdf", kind: "ajax", sections: true },
  },
};

const text = (pdf) =>
  execFileSync("pdftotext", ["-table", "-enc", "UTF-8", pdf, "-"], { maxBuffer: 1 << 28 }).toString("utf8");

const MODEL = /([A-Z][A-Z0-9]{1,}[A-Z0-9\-()/.]*[A-Z0-9)])/g;
const ENDS = /[.!?]["»)]?$/;
const tidy = (s) => s.replace(/\s{2,}/g, " ").trim();

/** სვეტის ყველაზე ხშირი პოზიცია */
const modal = (xs) => {
  const c = new Map();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
};

/**
 * Dahua — მარცხნივ ნომერი, შემდეგ მოდელი და არტიკული (#581760), შუაში აღწერა,
 * მარჯვნივ ფასი დოლარში. მწკრივი ვერტიკალურად ცენტრშია ნომრის ხაზზე.
 */
function parseDahua(raw) {
  const pages = raw.split("\f");
  const head = pages[0].split(/\r?\n/);
  const cut = head.findIndex((l) => /^\s*\d{2}\.\d{4}\s*$/.test(l)); // სათაური თარიღით მთავრდება
  if (cut >= 0) pages[0] = head.slice(cut + 1).join("\n");
  const lines = pages.join("\n").split(/\r?\n/);

  const artPos = [];
  lines.forEach((l, i) => {
    for (const m of l.matchAll(/#(\d{5,6})\b/g)) artPos.push({ i, x: m.index, art: m[1] });
  });
  const colX = modal(artPos.map((a) => a.x));
  const inCol = (x) => Math.abs(x - colX) <= 6;
  const arts = artPos.filter((a) => inCol(a.x));

  const modelAt = new Map(), priceAt = new Map(), sectionAt = new Map();
  lines.forEach((l, i) => {
    for (const m of l.matchAll(MODEL)) {
      if (inCol(m.index) && !/^\d+$/.test(m[1]) && !modelAt.has(i)) modelAt.set(i, m[1]);
    }
    const p = l.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
    if (p) priceAt.set(i, Number(p[1].replace(/,/g, "")));
    const s = l.match(/^(\s*)(\S.*?)\s*$/);
    if (s && s[1].length < colX - 2) {
      const txt = tidy(s[2].replace(/\s*\d{2}\.\d{4}\s*$/, ""));
      if (txt.length >= 6 && !/\$|^\d+$/.test(txt)) sectionAt.set(i, txt);
    }
  });

  // აღწერის სვეტი — გრძელი მოდელის ბოლო რომ არ ჩავარდეს („868)“)
  const descX =
    modal(lines.map((l) => l.match(/^(\s*)\S/)?.[1].length).filter((x) => x > colX + 4)) ?? colX + 8;
  const desc = lines.map((l) => tidy(l.slice(descX).replace(/\$\s?[\d,]+(\.\d{1,2})?/g, "")));

  const near = (map, i0) => {
    for (let d = 0; d <= 4; d++) for (const i of [i0 - d, i0 + d]) if (map.has(i)) return i;
    return i0;
  };
  const center = arts.map((a) => near(priceAt, a.i));
  const mid = (a, b) => Math.floor((a + b) / 2);

  const rows = arts.map((a, k) => {
    let section = "";
    for (const [i, t] of sectionAt) if (i <= a.i) section = t;
    const from = k === 0 ? 0 : mid(center[k - 1], center[k]) + 1;
    const to = k === arts.length - 1 ? lines.length - 1 : mid(center[k], center[k + 1]);
    const body = [];
    for (let i = from; i <= to; i++) if (desc[i] && !sectionAt.has(i)) body.push(desc[i]);
    return { art: a.art, model: modelAt.get(near(modelAt, a.i)) ?? "", price: priceAt.get(center[k]) ?? null, section, body };
  });

  // ტექსტი მწკრივის საზღვარს რომ გადასცდეს — წინა აღწერას ვუბრუნებთ
  for (let k = 1; k < rows.length; k++) {
    let moved = 0;
    while (moved++ < 3 && rows[k].body.length > 1 && !ENDS.test(rows[k - 1].body.at(-1) ?? ".")) {
      rows[k - 1].body.push(rows[k].body.shift());
    }
  }

  return rows.map((r) => {
    const description = tidy(r.body.join(" "));
    return { sku: r.model, model: r.model, art: r.art, price: r.price, section: r.section, description };
  });
}

/**
 * Ajax — ნომერი, მოდელი, აღწერა, ფასი (დოლარის ნიშნის გარეშე). განყოფილებები
 * მარცხენა კიდეშია და ქვეკატეგორიებად გადადის.
 */
function parseAjax(raw) {
  const pages = raw.split("\f");
  const lines = [];
  const descXAt = []; // აღწერის სვეტი გვერდობრივ ოდნავ იცვლება

  // პირველ გვერდზე სათაური ცხრილის თავამდეა — აღწერაში არ გვინდა
  const hi = pages[0].split(/\r?\n/).findIndex((l) => /მოდელი/.test(l) && /აღწერა/.test(l));
  if (hi >= 0) pages[0] = pages[0].split(/\r?\n/).slice(hi + 1).join("\n");

  for (const page of pages) {
    const pl = page.split(/\r?\n/);
    // გაგრძელების სტრიქონები (მხოლოდ აღწერა) აჩვენებს სვეტის დასაწყისს
    const x = modal(pl.map((l) => l.match(/^(\s{20,})\S/)?.[1].length).filter(Boolean)) ?? 35;
    for (const l of pl) { lines.push(l); descXAt.push(x); }
  }

  const PAGE_NO = /^\d+\s*\/\s*\d+$/;
  const PRICE = /\s([\d,]+\.\d{2})\s*$/;

  // პროდუქტის ხაზი: ნომრით იწყება და ფასით მთავრდება.
  // მოდელი ნომრის შემდეგიდან აღწერის სვეტამდეა — შიგნით ორმაგი დაშორებებიც
  // გვხვდება („Batch  of  Pass  (3 pcs)“), ამიტომ საზღვარი სვეტია და არა სივრცე.
  const hits = [];
  lines.forEach((l, i) => {
    const head = l.match(/^\s{0,4}(\d{1,3})\s{2,}/);
    const price = l.match(PRICE);
    if (!head || !price) return;
    const model = tidy(l.slice(head[0].length, descXAt[i]));
    if (!model || /^\d/.test(model)) return;
    hits.push({ i, no: +head[1], model, price: Number(price[1].replace(/,/g, "")) });
  });

  const sectionAt = new Map();
  lines.forEach((l, i) => {
    const m = l.match(/^(\s{0,2})(\S.*?)\s*$/);
    if (!m) return;
    const txt = tidy(m[2]);
    if (txt.length < 5 || PRICE.test(l) || /^#/.test(txt) || /USD|Ajax Systems/.test(txt)) return;
    sectionAt.set(i, txt);
  });

  const descAt = lines.map((l, i) => {
    const t = tidy(l.slice(descXAt[i]).replace(/\s*[\d,]+\.\d{2}\s*$/, ""));
    return PAGE_NO.test(t) ? "" : t;
  });

  const mid = (a, b) => Math.floor((a + b) / 2);
  return hits.map((h, k) => {
    const from = k === 0 ? 0 : mid(hits[k - 1].i, h.i) + 1;
    const to = k === hits.length - 1 ? lines.length - 1 : mid(h.i, hits[k + 1].i);
    let section = "";
    for (const [i, t] of sectionAt) if (i <= h.i) section = t;
    const body = [];
    for (let i = from; i <= to; i++) if (descAt[i] && !sectionAt.has(i)) body.push(descAt[i]);
    const code = h.model.replace(/^ajax[\s-]*/i, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
    return { sku: `AJAX-${code}`, model: h.model, art: "", price: h.price, section, description: tidy(body.join(" ")) };
  });
}

/**
 * ერთი და იგივე მოდელი რამდენიმე ვარიანტში — ფერი, ზომა, შეფუთვა — ნუსხაში
 * ერთი სახელით წერია. კოდს აღწერის მოკლე ჰეშს ვამატებთ: ერთმანეთისგან
 * განასხვავებს და ნუსხის განახლებისას იმავე პროდუქტს იმავე კოდი რჩება.
 */
function dedupe(rows) {
  const seen = new Map();
  for (const r of rows) seen.set(r.sku, (seen.get(r.sku) ?? 0) + 1);
  const used = new Set();
  for (const r of rows) {
    if (seen.get(r.sku) < 2) { used.add(r.sku); continue; }
    let h = 0;
    for (const ch of r.description || r.model) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    let sku = `${r.sku}-${h.toString(36).slice(-4).toUpperCase()}`;
    while (used.has(sku)) sku += "X";
    r.sku = sku;
    used.add(sku);
  }
  return rows;
}

/** დასახელება — ბრენდი და მოდელი წინ, შემდეგ აღწერის პირველი წინადადება */
function nameOf(r, brand) {
  const first = (r.description.split(/(?<=[.!?])\s+/)[0] ?? r.description).trim().replace(/[.\s]+$/, "");
  const short = first.length > 80 ? first.slice(0, 77).replace(/[\s,;:—-]+$/, "") + "…" : first;
  const model = r.model.startsWith(brand) ? r.model : `${brand} ${r.model}`;
  return tidy(short ? `${model} — ${short}` : model);
}

let total = 0;
fs.mkdirSync(OUT, { recursive: true });

for (const [slug, sheets] of Object.entries(SOURCES)) {
  const brand = slug === "ajax" ? "Ajax" : "Dahua";
  const wb = XLSX.utils.book_new();

  for (const [sheet, spec] of Object.entries(sheets)) {
    const pdf = path.join(DL, spec.file);
    if (!fs.existsSync(pdf)) {
      console.log(`⚠ ვერ მოიძებნა: ${spec.file}`);
      continue;
    }
    const rows = dedupe(spec.kind === "ajax" ? parseAjax(text(pdf)) : parseDahua(text(pdf)));
    const bad = rows.filter((r) => !r.sku || !r.price);
    if (bad.length) console.log(`⚠ ${sheet}: ${bad.length} სტრიქონი ფასის ან კოდის გარეშე`);

    const aoa = [["კოდი", "დასახელება", "ფასი, USD", "აღწერა", "არტიკული"]];
    let section = null;
    for (const r of rows) {
      if (!r.sku || !r.price) continue;
      if (spec.sections && r.section && r.section !== section) {
        section = r.section;
        aoa.push(["", section, "", "", ""]); // განყოფილების სტრიქონი → ქვეკატეგორია
      }
      aoa.push([r.sku, nameOf(r, brand), r.price, r.description, r.art]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheet);
    const n = aoa.length - 1 - (spec.sections ? new Set(rows.map((r) => r.section)).size : 0);
    total += n;
    console.log(`${slug}/${sheet}: ${n} პროდუქტი`);
  }

  const file = path.join(OUT, `${slug}.xlsx`);
  XLSX.writeFile(wb, file);
  console.log(`→ ${file}`);
}
console.log(`\nსულ ${total} პროდუქტი`);
