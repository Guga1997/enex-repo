import { readdir, readFile } from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
import type { FetchContext, SupplierAdapter, SupplierConfig, SupplierItem } from "./types";

/**
 * ERC საქართველო — API არ აქვს; პარტნიორებისთვის ღია პორტალია (erc-distribution.ge), სადაც კატეგორიების
 * გვერდებზე დევს კოდი, დასახელება, რეკომენდებული საცალო ფასი (RRP, ლარი) და „in stock / out of stock“.
 * აქედან მოგვაქვს მხოლოდ მფლობელის ჩამოთვლილი: PC კომპონენტები, Xerox-ის საბეჭდი ტექნიკა და Ardesto-ს
 * მაცივრები / სარეცხი / ჭურჭლის სარეცხი მანქანები (DEFAULT_SOURCES; fieldMap.sources ცვლის).
 *
 *   სია:     GET /cat/<id>-<slug>[--v<ბრენდის id>]/[page-N/]?_locale=en     — 24 პოზიცია გვერდზე
 *   დეტალი:  GET /ware/<id>-<slug>/?_locale=en                              — ფოტოები და მახასიათებლები
 *
 * გვერდი ~1.6 მბ-ია (მთელი მენიუ შიგ არის), ამიტომ დეტალს მხოლოდ იმ პოზიციაზე ვითხოვთ, რომელსაც ფოტო
 * ჯერ არ აქვს (ctx.known), და ერთ სინქზე არა უმეტეს detailsPerSync-ისა — დანარჩენი მომდევნო სინქებზე ივსება.
 *
 * ფასი: პორტალზე მხოლოდ RRP-ა. ERC-ის Excel-ებში (data/pricelists/erc/, სვეტები სათაურით: Model, Quantity,
 * PRICE GEL, PROMO PRICE GEL, RRP GEL, Promo RRP GEL) ოთხი ფასია და მფლობელის წესი ასეთია: სტრიქონის
 * ყველაზე მაღალი ფასი — საცალო, ყველაზე დაბალი — ჩვენი ასაღები ფასი. ფაილი ხელით იდება და თავისით არ
 * ახლდება, პორტალის ფასი (ისიც „მაღალი“, RRP) კი ყოველ სინქზე ახალია — ამიტომ საიტის საცალო ფაილის
 * მოდელებზეც პორტალიდან გადაიწერება. გამონაკლისი: პორტალის ფასი ჩვენს ასაღებ ფასს რომ არ აღემატებოდეს
 * (ზარალში გაყიდვა გამოვიდოდა) — მაშინ ფაილის მაღალი ფასი რჩება. ფაილის გარეშე პოზიციაზე „გამოგზავნილი
 * ფასი“ = პორტალის RRP და თვითღირებულება მიმწოდებლის ფასდაკლებით (supplierDiscount) ითვლება.
 * მიმწოდებლის წესი: საცალო — „მის საცალოზე“ (LIST), 0%.
 *
 * fieldMap (არასავალდებულო): { "skuPrefix": "ERC-", "detailsPerSync": 100, "inStockQty": 10,
 *                              "sources": [{ "path": "/cat/1527-materynski-platy", "category": ["…", "…"] }] }
 */
export const ERC_URL = "https://erc-distribution.ge";
export const ERC_PRICE_DIR = path.join(process.cwd(), "data", "pricelists", "erc");

export type ErcSource = { path: string; category: string[] };

const PC = "კომპიუტერის კომპონენტები";
const HOME = "საყოფაცხოვრებო ტექნიკა";
const PRINT = ["კომპიუტერული ტექნიკა", "პერიფერია", "პრინტერები და MFP"];
const ARDESTO = "--v2634";
const XEROX = "--v68";

export const DEFAULT_SOURCES: ErcSource[] = [
  // PC კომპონენტები — მთლიანად
  { path: "/cat/1531-protsesory-pk", category: [PC, "პროცესორები"] },
  { path: "/cat/1527-materynski-platy", category: [PC, "დედადაფები"] },
  { path: "/cat/1528-operatyvna-pamyat-ddr", category: [PC, "ოპერატიული მეხსიერება"] },
  { path: "/cat/1522-videokarty", category: [PC, "ვიდეობარათები"] },
  { path: "/cat/1524-nakopychuvachi-ssd", category: [PC, "დისკები (კომპიუტერისთვის)"] },
  { path: "/cat/1523-nakopychuvachi-hdd", category: [PC, "დისკები (კომპიუტერისთვის)"] },
  { path: "/cat/1521-bloky-zhyvlennya-pk", category: [PC, "კვების ბლოკები"] },
  { path: "/cat/1526-korpusy-pk", category: [PC, "ქეისები"] },
  { path: "/cat/1530-okholodzhennya-pk", category: [PC, "ქულერები"] },
  { path: "/cat/1532-termopasta", category: [PC, "ქულერები"] },
  { path: "/cat/1529-optychni-pryvody", category: [PC] },
  { path: "/cat/1525-zvukovi-karty", category: [PC] },
  { path: "/cat/1520-aksesuary-ta-optsiyi-kompyuternykh-komplektuyuchykh", category: [PC] },
  // Ardesto — მაცივრები, სარეცხი და ჭურჭლის სარეცხი მანქანები
  { path: `/cat/1383-kholodylnyky-pobutovi${ARDESTO}`, category: [HOME, "მაცივრები"] },
  { path: `/cat/1838-kholodylnyky-dorozhni${ARDESTO}`, category: [HOME, "მაცივრები"] },
  { path: `/cat/1373-kholodylnyky-pobutovi-vbudovani${ARDESTO}`, category: [HOME, "მაცივრები"] },
  // ფილტრიანი ქვეჯგუფის id ოფციების გარეშე მთელ ჯგუფს აბრუნებს (ყველა სარეცხი მანქანა, საშრობიანიც)
  { path: `/cat/2514-pralni-mashyny${ARDESTO}`, category: [HOME, "სარეცხი მანქანები"] },
  { path: `/cat/2510-posudomyyni-mashyny${ARDESTO}`, category: [HOME, "ჭურჭლის სარეცხი მანქანები"] },
  { path: `/cat/1371-posudomyyni-mashyny-vbudovani${ARDESTO}`, category: [HOME, "ჭურჭლის სარეცხი მანქანები"] },
  // Xerox — მრავალფუნქციური მოწყობილობები და პრინტერები
  { path: `/cat/1816-bfp-lazerni${XEROX}`, category: PRINT },
  { path: `/cat/2281-pryntery-lazerni${XEROX}`, category: PRINT },
];

/* ------------------------------- HTML → მონაცემი ------------------------------- */

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
export const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
      if (/^#x/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (/^#\d/.test(e)) return String.fromCodePoint(Number(e.slice(1)));
      return ENT[e.toLowerCase()] ?? m;
    })
    .replace(/[​ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type ErcRow = {
  wareId: string;
  href: string;
  slug: string;
  name: string;
  code: string;
  price: number | null;
  inStock: boolean;
};

/** კატეგორიის (ან ძებნის) გვერდი → პოზიციები და გვერდების რაოდენობა */
export function parseListing(html: string): { rows: ErcRow[]; pages: number } {
  const rows: ErcRow[] = [];
  for (const block of html.split('<div class="product-item__container">').slice(1)) {
    const link = block.match(/<div class="product-item__title">\s*<a href="(\/ware\/(\d+)-([^"/]+)\/?)"[^>]*>([\s\S]*?)<\/a>/);
    const code = block.match(/<div class="product-item__code">([\s\S]*?)<\/div>/);
    if (!link || !code) continue;
    const price = block.match(/<div class="product-item__price-current">\s*<span>([\s\S]*?)<\/span>/);
    const state = block.match(/<div class="product-item__price-text[^"]*">([\s\S]*?)<\/div>/);
    const n = price ? Number(text(price[1]).replace(/[^\d.,]/g, "").replace(",", ".")) : NaN;
    rows.push({
      wareId: link[2],
      href: link[1],
      slug: link[3],
      name: text(link[4]),
      // „SKU: X“ / „კოდი: X“ — ენის მიუხედავად ორწერტილის შემდეგ
      code: text(code[1]).replace(/^[^:]*:\s*/, ""),
      price: Number.isFinite(n) && n > 0 ? n : null,
      inStock: /^(in stock|ხელმისაწვდომია|в наличии)$/i.test(text(state?.[1] ?? "")),
    });
  }
  const pages = Math.max(1, ...[...html.matchAll(/\/page-(\d+)\//g)].map((m) => Number(m[1])));
  return { rows, pages };
}

export type ErcDetail = {
  images: string[];
  attributes: { name: string; value: string }[];
  weightKg: number | null;
  volumeM3: number | null;
  warrantyMonths: number | null;
};

const LOGISTIC = /^(სიგანე|სიმაღლე|სიგრძე|წონა|მოცულობა|გარანტია|width|height|length|weight|volume|warranty)$/i;

/** პროდუქტის გვერდი → ორიგინალი ფოტოები, მახასიათებლები, შეფუთვის წონა/მოცულობა, გარანტია */
export function parseDetail(html: string, base = ERC_URL): ErcDetail {
  const images: string[] = [];
  for (const m of html.matchAll(/(?:href|src|data-src|data-zoom-image)="(\/upload\/(?:uploaded_images|ware)\/[^"]+\.(?:jpe?g|png|webp))"/gi)) {
    const url = base + m[1];
    if (!/enlabel|energy|logotype/i.test(url) && !images.includes(url)) images.push(url);
  }
  const attributes: { name: string; value: string }[] = [];
  const logistic = new Map<string, string>();
  for (const m of html.matchAll(/<tr[^>]*>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>\s*<\/tr>/gi)) {
    const name = text(m[1]).replace(/:$/, "");
    const value = text(m[2]);
    if (!name || !value || name.length > 80 || value.length > 300) continue;
    // ბოლო ცხრილი — შეფუთვის ზომები და გარანტია (ლოგისტიკა): მახასიათებლებში არ ჩანს
    if (LOGISTIC.test(name)) { logistic.set(name.toLowerCase(), value); continue; }
    if (!attributes.some((a) => a.name === name)) attributes.push({ name, value });
  }
  const numOf = (keys: string[]) => {
    for (const k of keys) {
      const v = logistic.get(k);
      const n = v ? Number(v.replace(",", ".").match(/[\d.]+/)?.[0]) : NaN;
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  };
  return {
    images: images.slice(0, 10),
    attributes: attributes.slice(0, 40),
    weightKg: numOf(["წონა", "weight"]),
    volumeM3: numOf(["მოცულობა", "volume"]),
    warrantyMonths: numOf(["გარანტია", "warranty"]),
  };
}

/** ბრენდი პროდუქტის მისამართიდან: /ware/<id>-<ბრენდი>-… ; სლაგების სია პორტალის მენიუდან მოდის */
export function vendorSlugs(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/\/vendor\/([a-z0-9-]+)\/list\.html/g)) out.add(m[1]);
  return [...out].sort((a, b) => b.length - a.length);
}
const UPPER = new Set(["asus", "msi", "amd", "hp", "fsp", "qnap", "lg", "tcl", "aoc", "jbl", "wd", "pny", "adata", "nzxt", "benq"]);
export function brandOf(slug: string, vendors: string[]): string | null {
  const v = vendors.find((x) => slug === x || slug.startsWith(x + "-"));
  if (!v) return null;
  if (v === "2e") return "2E";
  return v
    .split("-")
    .map((w) => (UPPER.has(w) || /^\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/* --------------------------------- Excel-ის ფასები --------------------------------- */

export type ErcPrice = { cost: number | null; rrp: number | null; qty: number | null };

const numCell = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

/**
 * ERC-ის ფასთა ფაილი (ნებისმიერი ფურცელი, სვეტები სათაურით) → მოდელი → ჩვენი ფასი / საცალო / რაოდენობა.
 * ოთხი ფასიდან (PRICE, PROMO PRICE, RRP, Promo RRP) ყველაზე დაბალი ჩვენი ასაღები ფასია, ყველაზე მაღალი — საცალო.
 */
export function parsePriceBook(buf: Buffer): Map<string, ErcPrice> {
  const out = new Map<string, ErcPrice>();
  const wb = XLSX.read(buf, { type: "buffer" });
  for (const sheet of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, defval: "" });
    const head = rows.findIndex((r) => r.some((c) => /^model$/i.test(String(c).trim())));
    if (head < 0) continue;
    const col = (re: RegExp) => rows[head].findIndex((c) => re.test(String(c).trim()));
    const model = col(/^model$/i);
    const price = col(/^price\s*gel$/i);
    const promo = col(/^promo\s*price\s*gel$/i);
    const rrp = col(/^rrp\s*gel$/i);
    const promoRrp = col(/^promo\s*rrp\s*gel$/i);
    const qty = col(/^quantity$/i);
    for (const r of rows.slice(head + 1)) {
      const key = String(r[model] ?? "").trim();
      if (!key) continue;
      const q = String(r[qty] ?? "").trim();
      const nums = [price, promo, rrp, promoRrp].map((c) => (c >= 0 ? numCell(r[c]) : null)).filter((n): n is number => n !== null);
      if (!nums.length) continue;
      out.set(key.toUpperCase(), {
        cost: Math.min(...nums),
        rrp: Math.max(...nums),
        qty: qty >= 0 && q ? Math.max(0, Math.floor(Number(q.replace(/[^\d]/g, "")) || 0)) : null,
      });
    }
  }
  return out;
}

async function loadPriceBooks(dir = ERC_PRICE_DIR): Promise<Map<string, ErcPrice>> {
  const all = new Map<string, ErcPrice>();
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((f) => /\.(xlsx|xlsm|xls)$/i.test(f) && !f.startsWith("~"));
  } catch {
    return all; // საქაღალდე არ არის — მხოლოდ პორტალის მონაცემი
  }
  for (const f of files) {
    try {
      for (const [k, v] of parsePriceBook(await readFile(path.join(dir, f)))) all.set(k, v);
    } catch (e) {
      console.error(`ERC: ფასთა ფაილი ვერ წაიკითხა — ${f}`, e);
    }
  }
  return all;
}

/* ------------------------------------ სინქი ------------------------------------ */

type FieldMap = { skuPrefix?: string; detailsPerSync?: number; inStockQty?: number; sources?: ErcSource[] };
export type Get = (url: string) => Promise<string>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const httpGet: Get = async (url) => {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; partner-catalog-sync)", "Accept-Language": "en" },
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ERC: HTTP ${res.status} — ${new URL(url).pathname}`);
  return res.text();
};

const withLocale = (url: string) => url + (url.includes("?") ? "&" : "?") + "_locale=en";

export async function fetchErcItems(
  cfg: SupplierConfig,
  ctx: FetchContext = {},
  get: Get = httpGet,
  opts: { pauseMs?: number; prices?: Map<string, ErcPrice> } = {}
): Promise<SupplierItem[]> {
  const map = (cfg.fieldMap?.trim() ? JSON.parse(cfg.fieldMap) : {}) as FieldMap;
  const base = (cfg.baseUrl?.trim() || ERC_URL).replace(/\/+$/, "");
  const prefix = map.skuPrefix ?? "ERC-";
  const sources = map.sources?.length ? map.sources : DEFAULT_SOURCES;
  const detailsMax = map.detailsPerSync ?? 100;
  const nominalQty = map.inStockQty ?? 10;
  const pause = opts.pauseMs ?? 250;
  const prices = opts.prices ?? (await loadPriceBooks());

  const seen = new Map<string, { row: ErcRow; category: string[] }>();
  let vendors: string[] = [];
  for (const src of sources) {
    const url = (page: number) => withLocale(`${base}${src.path.replace(/\/+$/, "")}/${page > 1 ? `page-${page}/` : ""}`);
    // ერთი გვერდის ჩავარდნაც სინქს აჩერებს — ნახევარ სიაზე დანარჩენის ნაშთი განულდებოდა
    const first = await get(url(1));
    if (!vendors.length) vendors = vendorSlugs(first);
    const { rows, pages } = parseListing(first);
    const all = [...rows];
    for (let p = 2; p <= Math.min(pages, 60); p++) {
      await sleep(pause);
      all.push(...parseListing(await get(url(p))).rows);
    }
    for (const row of all) if (row.code && !seen.has(row.code)) seen.set(row.code, { row, category: src.category });
    await sleep(pause);
  }
  if (!seen.size) throw new Error("ERC: პორტალიდან ერთი პოზიციაც არ მოვიდა — სინქი ჩერდება, ნაშთები არ ნულდება");

  const items: SupplierItem[] = [];
  let details = 0;
  for (const { row, category } of seen.values()) {
    const supplierSku = prefix + row.code;
    const book = prices.get(row.code.toUpperCase());
    // საცალო — პორტალის (ყოველ სინქზე ახალი) ფასი; ფაილის მაღალი ფასი მხოლოდ მაშინ, როცა პორტალზე ფასი
    // არ არის ან ჩვენს ასაღებ ფასს არ აღემატება
    const portalOk = row.price !== null && (!book?.cost || row.price > book.cost);
    const rrp = portalOk ? row.price : (book?.rrp ?? row.price ?? null);
    // ფაილში ერთადერთი ფასი რომ ეწეროს (დაბალი = მაღალი), ის საცალოა და ჩვენი ფასი უცნობია
    const ownCost = book?.cost && (rrp === null || book.cost < rrp) ? book.cost : null;
    const item: SupplierItem = {
      supplierSku,
      name: row.name,
      model: row.code,
      brand: brandOf(row.slug, vendors),
      categoryPath: category,
      // ჩვენი ფასი Excel-იდან, თუ არის; სხვაგვარად „გამოგზავნილი ფასი“ RRP-ა და თვითღირებულება
      // მიმწოდებლის ფასდაკლებით ითვლება (supplierDiscount)
      cost: ownCost ?? rrp,
      listPrice: rrp,
      qty: row.inStock ? (book?.qty || nominalQty) : 0,
      status: row.inStock ? "IN_STOCK" : "OUT_OF_STOCK",
    };
    // ფოტო და მახასიათებლები — მხოლოდ მათზე, ვისაც ჯერ არ აქვს, და ერთ სინქზე შეზღუდულად
    if (!ctx.known?.has(supplierSku) && details < detailsMax) {
      details++;
      try {
        await sleep(pause);
        const d = parseDetail(await get(withLocale(base + row.href)), base);
        if (d.images.length) item.images = d.images;
        if (d.attributes.length) item.attributes = d.attributes;
        item.weightKg = d.weightKg;
        item.volumeM3 = d.volumeM3;
        item.warrantyMonths = d.warrantyMonths;
      } catch (e) {
        // დეტალის ჩავარდნა სიას არ აფუჭებს — მომდევნო სინქი ისევ ცდის
        console.error(`ERC: დეტალი ვერ მოვიდა — ${row.code}`, e instanceof Error ? e.message : e);
      }
    }
    items.push(item);
  }
  return items;
}

export const erc: SupplierAdapter = { fetchItems: (cfg, ctx) => fetchErcItems(cfg, ctx) };
