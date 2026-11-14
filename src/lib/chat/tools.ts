import type { Locale } from "../i18n/config";
import { LOCALES } from "../i18n/config";
import { translateAttr } from "../i18n/attributes";
import { clip } from "../seo";
import { categoryTree, getProduct, searchProducts, storeInfo, type AssistantProduct } from "../assistant";

/**
 * AI კონსულტანტის ხელსაწყოები. იგივე ლოგიკა, რაც /api/assistant-ს აქვს (lib/assistant.ts),
 * ოღონდ პირდაპირ ბაზიდან, HTTP-ის გარეშე: ხილვადობის წესი ერთია, შიდა ველები (თვითღირებულება,
 * მიმწოდებელი…) იქვე იჭრება. აქ მხოლოდ ის ემატება, რაც მოდელს სჭირდება — შეკუმშული ჩანაწერი
 * (კონტექსტი პატარაა, პასუხი ჩქარი) და ძებნის სათადარიგო ვარიანტები.
 */

/* ───────────────────────────── აღწერა მოდელისთვის ───────────────────────────── */

export const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_products",
      description:
        "ეძებს პროდუქტებს enex.ge-ის კატალოგში. აბრუნებს სახელს, ფასს ლარში, მარაგის მდგომარეობას, ბმულს და მთავარ მახასიათებლებს. პროდუქტზე, ფასზე ან მარაგზე პასუხამდე ყოველთვის ეს გამოიძახე.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "საძიებო სიტყვები: პროდუქტის სახეობა, ბრენდი, მოდელი ან კოდი (მაგ. „ინვერტორი 12V“, „hikvision 4mp“)" },
          category: { type: "string", description: "კატეგორიის slug list_categories-იდან (არასავალდებულო)" },
          in_stock_only: { type: "boolean", description: "true — მხოლოდ ის, რაც ახლა მარაგშია" },
          limit: { type: "integer", description: "რამდენი შედეგი (ნაგულისხმევად 6, მაქს. 10)" },
        },
        required: ["q"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product",
      description: "ერთი პროდუქტის სრული მონაცემები (აღწერა, ყველა მახასიათებელი) კოდით (SKU) ან id-ით.",
      parameters: {
        type: "object",
        properties: { id_or_sku: { type: "string", description: "პროდუქტის კოდი (sku) ან id" } },
        required: ["id_or_sku"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_categories",
      description: "მაღაზიის კატეგორიები და თითოეულში პროდუქტების რაოდენობა. ზოგად კითხვაზე („რა გაქვთ?“) ეს გამოიძახე.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "store_info",
      description: "მაღაზიის პირობები: მიწოდება, გადახდა, გარანტია, დაბრუნება, კონტაქტი და სამუშაო საათები.",
      parameters: { type: "object", properties: {} },
    },
  },
] as const;

/* ───────────────────────────── შეკუმშული ჩანაწერი ───────────────────────────── */

/** მახასიათებლები, რომლებიც მყიდველს არაფერს ეუბნება (მიმწოდებლის შიდა ველები) */
const SKIP_ATTRS = ["Vendor", "Condition of the product", "Section subcategories"];
const SKIPPED = new Set(
  SKIP_ATTRS.flatMap((n) => [n, ...LOCALES.map((l) => translateAttr(n, l))]).map((n) => n.trim().toLowerCase()),
);

const cut = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
};

type CompactOpts = { attrs: number; valueMax: number; descMax: number };
const LIST: CompactOpts = { attrs: 6, valueMax: 60, descMax: 160 };
const FULL: CompactOpts = { attrs: 20, valueMax: 120, descMax: 500 };

/** ის, რასაც მოდელი ხედავს ერთ პროდუქტზე. ცარიელი ველები არ გადაეცემა. */
export function compact(p: AssistantProduct, o: CompactOpts = LIST) {
  const attributes: Record<string, string> = {};
  for (const a of p.attributes) {
    if (Object.keys(attributes).length >= o.attrs) break;
    if (SKIPPED.has(a.name.trim().toLowerCase()) || !a.value.trim()) continue;
    attributes[a.name] = cut(a.value, o.valueMax);
  }
  const description = "description" in p && p.description ? p.description : p.shortDescription;
  const rec: Record<string, unknown> = {
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    model: p.model,
    category: p.category,
    price: p.price,
    oldPrice: p.oldPrice,
    discountPercent: p.discountPercent,
    warrantyMonths: p.warrantyMonths,
    stock: p.stock.label,
    url: p.url,
    shortDescription: description ? clip(description, o.descMax) : null,
    attributes: Object.keys(attributes).length ? attributes : null,
  };
  for (const k of Object.keys(rec)) if (rec[k] == null || rec[k] === "") delete rec[k];
  return rec;
}

/* ───────────────────────────── ძებნის სათადარიგო ვარიანტები ───────────────────────────── */

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const UNITS: [RegExp, string][] = [
  [new RegExp(`${NUM}\\s*kw\\b`, "giu"), "კვტ"],
  [new RegExp(`${NUM}\\s*mp\\b`, "giu"), "მპ"],
  [new RegExp(`${NUM}\\s*v\\b`, "giu"), "ვოლტი"],
  [new RegExp(`${NUM}\\s*w\\b`, "giu"), "ვატი"],
];
const UNIT_WORDS = new Set(["v", "w", "kw", "mp", "ვოლტი", "ვატი", "კვტ", "მპ", "ვ", "ვტ"]);

/** „12V 1000W“ → საიტისეული ჩაწერა: „12 ვოლტი 1000 ვატი“ (და უშუალოდ მიწერილიც: „12ვოლტი“) */
export function siteUnits(q: string): string[] {
  const out = new Set<string>();
  for (const sep of [" ", ""]) {
    let s = q;
    for (const [re, unit] of UNITS) s = s.replace(re, `$1${sep}${unit}`);
    if (s !== q) out.add(s);
  }
  return [...out];
}

/** ციფრების და ერთეულების გარეშე: „ინვერტორი 12V 1000W“ → „ინვერტორი“ */
export function withoutNumbers(q: string): string {
  return q
    .split(/\s+/)
    .filter((w) => w && !/\d/.test(w) && !UNIT_WORDS.has(w.toLowerCase()))
    .join(" ");
}

/** რა სხვა ჩაწერით ვცადოთ, თუ ძებნამ ცოტა იპოვა — რიგით: ერთეულები, მერე ციფრების გარეშე */
export function fallbackQueries(q: string): string[] {
  const base = q.replace(/\s+/g, " ").trim();
  const seen = new Set([base.toLowerCase()]);
  const out: string[] = [];
  for (const alt of [...siteUnits(base), withoutNumbers(base)]) {
    const a = alt.replace(/\s+/g, " ").trim();
    if (a.length < 2 || seen.has(a.toLowerCase())) continue;
    seen.add(a.toLowerCase());
    out.push(a);
  }
  return out;
}

/* ───────────────────────────── შესრულება ───────────────────────────── */

const SEARCH_LIMIT = 6;
const SEARCH_LIMIT_MAX = 10;
/** ამაზე ნაკლები შედეგისას სხვა ჩაწერითაც ვეძებთ */
const FEW = 3;

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").trim();
const bool = (v: unknown) => v === true || v === "true" || v === 1;

export type ToolResult = {
  /** ის, რაც მოდელს გადაეცემა */
  content: string;
  /** მოკლე ჩანაწერი ადმინის „AI ჩატები“ გვერდისთვის */
  log: Record<string, unknown>;
};

async function search(args: Record<string, unknown>, lang: Locale): Promise<ToolResult> {
  const q = str(args.q).slice(0, 200);
  let category = str(args.category);
  const inStock = bool(args.in_stock_only);
  const n = Math.floor(Number(args.limit));
  const limit = Number.isFinite(n) && n >= 1 ? Math.min(n, SEARCH_LIMIT_MAX) : SEARCH_LIMIT;
  if (!q && !category) {
    return { content: JSON.stringify({ error: "მიუთითე საძიებო სიტყვა (q)" }), log: { error: "ცარიელი მოთხოვნა" } };
  }

  const notes: string[] = [];
  const run = async (query: string) => {
    let r = await searchProducts({ q: query || undefined, category: category || undefined, inStock, limit, lang });
    if ("error" in r) {
      // უცნობი კატეგორია: მთელ კატალოგში ვეძებთ, თორემ მოდელი ცარიელ პასუხს მიიღებდა
      notes.push(`კატეგორია „${category}“ ვერ მოიძებნა — ძებნა მთელ კატალოგშია`);
      category = "";
      r = await searchProducts({ q: query || undefined, inStock, limit, lang });
    }
    return "error" in r ? { total: 0, items: [] as AssistantProduct[], correctedQuery: undefined } : r;
  };

  const first = await run(q);
  const items = [...first.items];
  let found = first.total;
  const tried = [q];
  if (first.correctedQuery) notes.push(`მოიძებნა როგორც „${first.correctedQuery}“`);

  if (q && items.length < FEW) {
    for (const alt of fallbackQueries(q)) {
      if (items.length >= limit) break;
      const more = await run(alt);
      tried.push(alt);
      let added = 0;
      for (const it of more.items) {
        if (items.length >= limit) break;
        if (items.some((x) => x.sku === it.sku)) continue;
        items.push(it);
        added++;
      }
      if (added) {
        found = Math.max(found, items.length, more.total);
        notes.push(`დამატებით მოიძებნა „${alt}“-ით`);
      }
    }
  }

  const body: Record<string, unknown> = { query: q, found, shown: items.length, items: items.map((p) => compact(p)) };
  if (notes.length) body.note = notes.join("; ");
  return {
    content: JSON.stringify(body),
    log: { found, shown: items.length, skus: items.map((p) => p.sku), ...(tried.length > 1 ? { tried } : {}) },
  };
}

async function product(args: Record<string, unknown>, lang: Locale): Promise<ToolResult> {
  const key = str(args.id_or_sku ?? args.sku ?? args.id).slice(0, 100);
  const p = key ? await getProduct(key, lang) : null;
  if (!p) {
    return {
      content: JSON.stringify({ error: `პროდუქტი „${key}“ ვერ მოიძებნა — სცადე search_products` }),
      log: { found: 0 },
    };
  }
  return { content: JSON.stringify(compact(p, FULL)), log: { found: 1, skus: [p.sku] } };
}

/** მხოლოდ 2 დონე: „სახელი [slug] — რაოდენობა“; ცარიელი კატეგორია არ ჩანს */
export async function categoriesText(lang: Locale): Promise<string> {
  const tree = await categoryTree(lang);
  const lines: string[] = [];
  for (const root of tree) {
    if (!root.productCount) continue;
    lines.push(`${root.name} [${root.slug}] — ${root.productCount}`);
    for (const c of root.children) if (c.productCount) lines.push(`  - ${c.name} [${c.slug}] — ${c.productCount}`);
  }
  return lines.join("\n");
}

export const TOOL_NAMES = TOOLS.map((t) => t.function.name) as readonly string[];

export async function runTool(name: string, args: Record<string, unknown>, lang: Locale): Promise<ToolResult> {
  switch (name) {
    case "search_products":
      return search(args, lang);
    case "get_product":
      return product(args, lang);
    case "list_categories": {
      const text = await categoriesText(lang);
      return { content: text, log: { lines: text.split("\n").length } };
    }
    case "store_info": {
      const text = storeInfo(lang).markdown;
      return { content: text, log: { chars: text.length } };
    }
    default:
      return {
        content: JSON.stringify({ error: `ხელსაწყო „${name}“ არ არსებობს. არის: ${TOOL_NAMES.join(", ")}` }),
        log: { error: "უცნობი ხელსაწყო" },
      };
  }
}
