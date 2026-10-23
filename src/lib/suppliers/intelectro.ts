import type { FetchContext, SupplierAdapter, SupplierConfig, SupplierItem } from "./types";
import { authHeaders } from "./types";

/**
 * intelectro.ge API v1 (Postman: documenter.getpostman.com/view/8332784/2sAXqv6LsT)
 *
 *   POST {baseUrl}/products         — სრული სია: code, namege, price, instock, reserved, brand
 *   POST {baseUrl}/product/{code}   — ერთი პროდუქტი: კატეგორია, ფოტოები, აღწერა, ფაილები
 *
 * baseUrl  → https://intelectro.ge/api/v1
 * authType → HEADER_KEY, authHeader → "api-key"
 *
 * ერთ ფასს აგზავნის. მოდელის ველი არ აქვს — სახელიდან ვიღებთ („…, IPC-B125-APF40“),
 * რომ სხვა მიმწოდებლისგან უკვე არსებული იგივე ნივთი ცალკე ბარათად არ გაჩნდეს.
 *
 * ერთი პროდუქტის მისამართი არასანდოა: კოდი ჰარით ან „/“-ით მთავარ გვერდზე
 * გადაჰყავს, ზოგზე PHP-ის შეცდომა ბრუნდება. ამიტომ სია ბაზაა, დეტალი — დამატება,
 * და მხოლოდ იმ პოზიციაზე ვითხოვთ, რომელიც ჯერ არ ვიცით (ctx.known).
 * ფასის გარეშე (0) პოზიცია „ფასი მოთხოვნით“-ია — არ შემოგვაქვს.
 */

type IeRow = {
  id?: string;
  code?: string;
  namege?: string;
  price?: string | number | null;
  instock?: string | number | null;
  reserved?: string | number | null;
  brand?: string | null;
};

type IeDetail = IeRow & {
  categoryall?: string | null;
  img?: string | null;
  img2?: string | null;
  img3?: string | null;
  additional_imgs?: string | null;
  files?: string | null;
  bigtext?: string | null;
  smalldesc?: string | null;
};

const DETAIL_CONCURRENCY = 4;

const num = (v: unknown): number => {
  const n = Number(String(v ?? "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
};

/** დეტალის მისამართში უსაფრთხოდ ჩაჯდება — დანარჩენზე სერვერი გადამისამართებს */
const urlSafe = (code: string) => /^[A-Za-z0-9._-]+$/.test(code);

/** ციფრით დაწყებული ზომა/სიმძლავრეა (2.8mm, 60W), ეს კი სტანდარტები — არა მოდელი */
const NOT_MODEL = /^(IP\d{2}|IK\d{2}|EN\d+|H\.?26\d|USB\d?|Wi-?Fi\d?|LTE\d?|DDR\d)$/i;

/**
 * მოდელი სახელიდან: ლათინური ასოთი დაწყებული, ციფრიანი, ≥ 4 სიმბოლო; რამდენიმე
 * თუა, უგრძესი („IP კამერა, Uniarch 5MP Bullet, 4.0mm, mic, IPC-B125-APF40“ → IPC-B125-APF40).
 */
export function modelFromName(name: string): string | null {
  let best: string | null = null;
  for (const raw of name.split(/[\s,;()]+/)) {
    const t = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+]+$/g, "");
    if (t.length < 4 || !/^[A-Za-z]/.test(t) || !/\d/.test(t)) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9\-/.+]*$/.test(t) || NOT_MODEL.test(t)) continue;
    if (!best || t.length > best.length) best = t;
  }
  return best;
}

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", deg: "°", plusmn: "±",
  times: "×", micro: "µ", sup2: "²", sup3: "³", ndash: "–", mdash: "—", laquo: "«", raquo: "»",
};

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** უჯრის ტექსტი: ხაზები „; “-ით, ტეგები და ზედმეტი ჰარები მოშორებული */
function cellText(html: string): string {
  return decode(
    html
      .replace(/<br\s*\/?>/gi, "; ")
      .replace(/<\/p>\s*<p[^>]*>/gi, "; ")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\s+/g, " ")
    .replace(/(\s*;\s*)+/g, "; ")
    .replace(/^[;\s]+|[;\s]+$/g, "")
    .trim();
}

/** bigtext-ის ცხრილი „სახელი | მნიშვნელობა“ → მახასიათებლები */
export function specsFromHtml(html: string | null | undefined): { name: string; value: string }[] {
  if (!html) return [];
  const out: { name: string; value: string }[] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => cellText(c[1]));
    if (cells.length !== 2) continue;
    const [name, value] = cells;
    if (name && value && name.length <= 80) out.push({ name, value });
  }
  return out;
}

const urls = (...vals: (string | null | undefined)[]) => {
  const seen = new Set<string>();
  for (const v of vals) {
    for (const part of String(v ?? "").split(",")) {
      const u = part.trim();
      // „https://intelectro.ge/“ — ცარიელი ჩანაწერი, ფაილი არ არის
      if (/^https?:\/\/[^/]+\/.+/.test(u)) seen.add(u);
    }
  }
  return [...seen];
};

function docTitle(url: string): string {
  const file = url.split("/").pop() ?? url;
  let name = file;
  try {
    name = decodeURIComponent(file);
  } catch {
    /* დაზიანებული %-კოდი — ისე ვტოვებთ */
  }
  return name.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[_]+/g, " ").trim() || "ფაილი";
}

/**
 * ინტელექტროს ხე → ჩვენი კატეგორია (სახელი ზუსტად ჩვენი ხიდან). პირველი დამთხვევა
 * მოქმედებს; აქ რაც არ წერია, resolveCategoryId სახელით პოულობს (IP კამერები,
 * დომოფონები, სირენები…). ცალკე წესი იმიტომ სჭირდება, რომ ზოგადი დამთხვევა აქ
 * ცდება: „დაშვების კონტროლი“ სასტუმროს დაშვებაზე ჯდებოდა, საკეტები და
 * საევაკუაციო დინამიკები ძირში, სვიჩები და ჭკვიანი სახლი — საიმპორტოში.
 */
const CATEGORY_RULES: { path: RegExp; name?: RegExp; to: string }[] = [
  { path: /> დეტექტორები/, name: /მოძრაობის/, to: "მოძრაობის დეტექტორები" },
  { path: /> დეტექტორები/, name: /მსხვრევის/, to: "მინის მსხვრევის დეტექტორები" },
  { path: /> დეტექტორები/, name: /გაღების/, to: "გაღების დეტექტორები" },
  { path: /სახანძრო სიგნალიზაცია > ავტონომიური/, to: "ხანძრის დეტექტორები" },
  { path: /დაცვითი სიგნალიზაცია > (კლავიატურები|პულტები)/, to: "მართვის მოწყობილობები და პანიკის ღილაკები" },
  { path: /დაცვითი სიგნალიზაცია > (გამაფართოვებელი მოდულები|GSM გადამცემები)/, to: "ინტეგრაციის მოდულები" },
  { path: /^უსაფრთხოების სისტემები > (საკეტები|დაშვების კონტროლი)/, to: "დაშვების სისტემა" },
  { path: /საევაკუაციო გახმოვანება > დინამიკები/, to: "ხმამაღლამოლაპარაკეები" },
  { path: /საევაკუაციო გახმოვანება > მიკროფონები/, to: "გახმოვანების აქსესუარები" },
  { path: /საევაკუაციო გახმოვანება > გამაძლიერებლები/, to: "ხმის გამაძლიერებლები" },
  { path: /საევაკუაციო გახმოვანება/, to: "გახმოვანების სისტემები" },
  { path: /^ქსელები > PoE სვიჩები/, to: "არამართვადი PoE სვიჩები" },
  { path: /^ქსელები > სვიჩები/, to: "არამართვადი სვიჩები" },
  { path: /^ქსელები > WiFi დაშვების/, to: "დაშვების წერტილები Access Points" },
  { path: /კვების ბლოკები > უწყვეტი კვების/, to: "კვების ბლოკები ანალოგური კამერებისთვის" },
  { path: /კვების ბლოკები > აკუმულატორები/, to: "ტყვია-მჟავას აკუმულატორები" },
  { path: /სადენები > სახანძრო/, to: "სახანძრო კაბელი" },
  { path: /სადენები > CCTV/, to: "LAN კაბელები" },
  { path: /სადენები > დაცვითი/, to: "დაცვითი სიგნალიზაცია" },
  { path: /მეხსიერების ბარათები/, to: "SD ბარათები" },
  { path: /^ჭკვიანი სახლი > ჩამრთველები/, to: "ჭკვიანი ჩამრთველები (LightSwitch)" },
  { path: /^ჭკვიანი სახლი/, to: "ავტომატიზაცია" },
];

/** მათი გზა + ჩვენი კატეგორია ბოლოში — resolveCategoryId ბოლოდან იწყებს ძებნას */
export function categoryPathOf(theirs: string[], name: string): string[] | undefined {
  if (!theirs.length) return undefined;
  const joined = theirs.join(" > ");
  const rule = CATEGORY_RULES.find((r) => r.path.test(joined) && (!r.name || r.name.test(name)));
  return rule ? [...theirs, rule.to] : theirs;
}

/** სიის ჩანაწერი (+ დეტალი, თუ მოვიდა) → ჩვენი ფორმა */
export function toItem(row: IeRow, detail?: IeDetail | null): SupplierItem | null {
  const sku = String(row.code ?? "").trim();
  const name = String(row.namege ?? "").replace(/\s+/g, " ").trim();
  const price = num(row.price);
  if (!sku || !name || price <= 0) return null;

  const qty = Math.max(0, Math.floor(num(row.instock) - num(row.reserved)));
  const d = detail ?? null;
  const theirs = String(d?.categoryall ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const description = d?.smalldesc?.trim() || null;

  return {
    supplierSku: sku,
    name,
    model: modelFromName(name),
    brand: row.brand?.trim() || null,
    categoryPath: categoryPathOf(theirs, name),
    description,
    cost: price,
    listPrice: null,
    qty,
    status: qty > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
    images: d ? urls(d.img, d.img2, d.img3, d.additional_imgs) : undefined,
    attributes: d ? specsFromHtml(d.bigtext) : undefined,
    documents: d ? urls(d.files).map((url) => ({ title: docTitle(url), url })) : undefined,
  };
}

async function post(url: string, cfg: SupplierConfig): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", ...authHeaders(cfg) },
    redirect: "manual", // გადამისამართება = „ასეთი არ არის“, მთავარი გვერდის HTML არ გვინდა
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`პასუხი JSON არ არის: ${text.replace(/<[^>]+>/g, " ").trim().slice(0, 120)}`);
  }
}

async function detailOf(base: string, code: string, cfg: SupplierConfig): Promise<IeDetail | null> {
  if (!urlSafe(code)) return null;
  try {
    const body = (await post(`${base}/product/${code}`, cfg)) as { products?: IeDetail[] };
    const p = body.products?.[0];
    return p && String(p.code ?? "").trim() === code ? p : null;
  } catch {
    return null; // ერთი პროდუქტის შეცდომა სინქს არ აჩერებს — სიის მონაცემი რჩება
  }
}

export const intelectro: SupplierAdapter = {
  async fetchItems(cfg: SupplierConfig, ctx?: FetchContext): Promise<SupplierItem[]> {
    if (!cfg.baseUrl) throw new Error("baseUrl მითითებული არ არის");
    if (!cfg.secret) throw new Error("API გასაღები მითითებული არ არის");
    const base = cfg.baseUrl.replace(/\/+$/, "").replace(/\/products$/, "");

    const body = (await post(`${base}/products`, cfg)) as { products?: IeRow[]; status?: string };
    const rows = body.products;
    if (!Array.isArray(rows)) throw new Error(`პასუხში products სია არ არის${body.status ? ` (${body.status})` : ""}`);

    const priced = rows.filter((r) => String(r.code ?? "").trim() && num(r.price) > 0);
    const want = priced.map((r) => String(r.code).trim()).filter((c) => !ctx?.known?.has(c));

    const details = new Map<string, IeDetail>();
    for (let i = 0; i < want.length; i += DETAIL_CONCURRENCY) {
      const batch = want.slice(i, i + DETAIL_CONCURRENCY);
      const got = await Promise.all(batch.map((c) => detailOf(base, c, cfg)));
      got.forEach((d, j) => d && details.set(batch[j], d));
    }

    return priced.flatMap((r) => {
      const item = toItem(r, details.get(String(r.code).trim()));
      return item ? [item] : [];
    });
  },
};
