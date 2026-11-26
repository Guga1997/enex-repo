import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupplierAdapter, SupplierConfig, SupplierItem } from "./types";

/**
 * მიმწოდებელი, რომელიც ფასებსა და ნაშთებს Google Drive-ის ფოლდერში დებს CSV ფაილებად
 * (API-ს ნაცვლად) და იქვე ანახლებს. ყოველ სინქზე ფაილები Drive-იდან თავიდან იკითხება.
 *
 * baseUrl  → ფოლდერის ბმული ან id (https://drive.google.com/drive/folders/<id>)
 * fieldMap → { "files": ["dahua_channel.csv", "dahua_wisualarm.csv"],
 *              "brands": { "Dahua Technology": "Dahua", "Wisualarm": "Dahua" },          — არასავალდებულო
 *              "discounts": { "dahua_channel.csv": 30, "dahua_wisualarm.csv": 35 },     — ჩვენი ფასდაკლება, %
 *              "discountRules": [{ "word": "კაბელ", "discount": 5 }],                  — სახელით, ფაილისაზე წინ
 *              "photos": "data/dahua-photos.json" }                                     — მოდელი → ფოტოები
 *
 * წვდომა (ერთ-ერთი):
 *   • სერვისის ანგარიში — ფოლდერი მის ელფოსტასაც უზიარდება (ნახვა). გასაღები სერვერზეა:
 *     GOOGLE_SERVICE_ACCOUNT_FILE=/გზა/key.json  ან  GOOGLE_SERVICE_ACCOUNT_JSON='{"client_email":…}'
 *   • საჯარო ფოლდერი („ყველას, ვისაც ბმული აქვს“) — secret-ში Google API გასაღები.
 *   • Apps Script — როცა ფოლდერზე მხოლოდ ნახვის უფლება გვაქვს და სხვას ვერ ვუზიარებთ: იმავე Google
 *     ანგარიშში გაშვებული სკრიპტი (deploy/google-drive-reader.gs). baseUrl — მისი /exec ბმული, secret — გასაღები.
 *
 * ფაილის სვეტებს სათაურით ვპოულობთ და არა რიგით: სვეტი რომ გადაადგილდეს, სინქი გააგრძელებს;
 * საჭირო სვეტი რომ გაქრეს — შეცდომით გაჩერდება და ნაშთებს არ გაანულებს.
 *
 * ფასი: ფაილში მათი საცალოა. ფასდაკლება თუ მითითებულია, პოზიცია ორი ფასით მოდის — მათი
 * საცალო (listPrice) და ჩვენი თვითღირებულება (cost = საცალო − ფასდაკლება); საიტის ფასს
 * მიმწოდებლის წესი წყვეტს („მის საცალოზე“, 0%). ფასდაკლების გარეშე — ერთი ფასი (cost),
 * როგორც Excel-ის ნუსხებზე.
 */

type DiscountRule = { word: string; discount: number };
/**
 * მათი კატეგორია → ჩვენი კატეგორიის გზა. პირველი დამთხვეული წესი მოქმედებს; ყველა მითითებული
 * პირობა უნდა ემთხვეოდეს (file — ფაილის სახელი, category / type — მათი სვეტები, word — სიტყვა სახელში).
 */
export type CategoryRule = { file?: string; category?: string; type?: string; word?: string; path: string[] };
type FieldMap = {
  files?: string[];
  brands?: Record<string, string>;
  discounts?: Record<string, number>;
  discountRules?: DiscountRule[];
  categories?: CategoryRule[];
  photos?: string;
  /** მომწოდებლის კოდის წინსართი (მაგ. „DH-“) — რიცხვითი კოდები მიმწოდებლებს შორის ემთხვევა */
  skuPrefix?: string;
};
export type ParseOptions = {
  brands?: Record<string, string>;
  categories?: CategoryRule[];
  /** ამ ფაილის ფასდაკლება, % */
  discount?: number;
  rules?: DiscountRule[];
  /** მოდელი (ობიექტივის გარეშეც) → ფოტოები */
  photos?: Record<string, string[]>;
  skuPrefix?: string;
};

type Init = { method?: string; headers?: Record<string, string>; body?: string };
type Res = { ok: boolean; status: number; text(): Promise<string> };
export type Transport = (url: string, init?: Init) => Promise<Res>;

const web: Transport = (url, init) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(60_000), cache: "no-store" });

/* ────────────────────────────── CSV ────────────────────────────── */

/** RFC 4180: ბრჭყალებში მძიმე და ახალი ხაზი ტექსტის ნაწილია; გამყოფი — მძიმე, ; ან ტაბი */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const first = src.slice(0, src.search(/\r?\n/) === -1 ? src.length : src.search(/\r?\n/));
  const sep = [",", ";", "\t"].reduce((a, b) => (first.split(b).length > first.split(a).length ? b : a));
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const COLUMNS = {
  sku: "შტრიხკოდი",
  name: "დასახელება",
  category: "პროდუქციის კატეგორია",
  type: "პროდუქციის ტიპი",
  brand: "მწარმოებელი",
  price: "საცალო ფასი ლარი",
  qty: "ჯამური ხელმისაწვდომი ნაშთი",
} as const;

const number = (s: string | undefined): number | null => {
  const clean = (s ?? "").replace(/\s/g, "").replace(",", ".");
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
};

/** ობიექტივის აღნიშვნა კამერის მოდელის მერე: „2.8mm“, „3.6მმ“, „2.7-12mm“ — სხვადასხვა ნივთია */
const LENS = /^\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?(?:mm|მმ)$/i;

/** „IPC-HFW1439TL1-A-IL 2.8mm 4მპ Bullet კამერა … #582151“ → მოდელი და დანარჩენი */
export function splitName(raw: string, sku: string): { model: string; rest: string } {
  const clean = raw.replace(new RegExp(`\\s*#\\s*${sku.replace(/[^\w-]/g, "")}\\s*$`), "").replace(/\s+/g, " ").trim();
  const parts = clean.split(" ");
  const take = parts.length > 2 && LENS.test(parts[1]) ? 2 : 1;
  return { model: parts.slice(0, take).join(" "), rest: parts.slice(take).join(" ") };
}

/** სიტყვა სახელში — სიტყვის თავიდან: „კაბელ“ ემთხვევა „კაბელი“-ს, მაგრამ არა „საკაბელო“-ს */
const hasWord = (name: string, word: string) =>
  (" " + name.toLowerCase().replace(/[,.;:()/\-]/g, " ")).includes(" " + word.trim().toLowerCase());

/** ერთი CSV → პოზიციები. file — შეცდომის ტექსტისთვის. */
export function parseDriveCsv(text: string, file: string, opts: ParseOptions = {}): SupplierItem[] {
  const brands = opts.brands ?? {};
  const [head, ...rows] = parseCsv(text);
  if (!head) throw new Error(`${file}: ფაილი ცარიელია`);
  const titles = head.map((h) => h.trim());
  const at = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, title]) => {
      const i = titles.indexOf(title);
      if (i < 0) throw new Error(`${file}: სვეტი „${title}“ ვერ ვიპოვე — ფაილის ფორმატი შეიცვალა`);
      return [key, i];
    })
  ) as Record<keyof typeof COLUMNS, number>;

  const items: SupplierItem[] = [];
  for (const r of rows) {
    const sku = (r[at.sku] ?? "").trim();
    const rawName = (r[at.name] ?? "").trim();
    if (!sku || !rawName) continue;
    const { model, rest } = splitName(rawName, sku);
    const maker = (r[at.brand] ?? "").trim();
    const brand = brands[maker] ?? maker ?? null;
    const price = number(r[at.price]);
    const qty = Math.max(0, Math.floor(number(r[at.qty]) ?? 0));
    const retail = price && price > 0 ? Math.round(price * 100) / 100 : null;
    const pct = opts.rules?.find((x) => hasWord(rawName, x.word))?.discount ?? opts.discount;
    const discounted = retail !== null && typeof pct === "number" && pct > 0 && pct < 100;
    const images = opts.photos?.[model] ?? opts.photos?.[model.split(" ")[0]];
    const theirCategory = (r[at.category] ?? "").trim();
    const theirType = (r[at.type] ?? "").trim();
    const same = (a: string | undefined, b: string) => a === undefined || a.trim().toLowerCase() === b.toLowerCase();
    const mapped = opts.categories?.find(
      (c) => same(c.file, file) && same(c.category, theirCategory) && same(c.type, theirType) && (!c.word || rawName.toLowerCase().includes(c.word.toLowerCase()))
    );
    items.push({
      // რიცხვითი შტრიხკოდი სხვა მიმწოდებლის კოდს რომ არ დაემთხვეს (პროდუქტები აირეოდა) — პრეფიქსით
      supplierSku: (opts.skuPrefix ?? "") + sku,
      // საიტის სტილით: „Dahua HY-1301 — სამისამართო კვამლის დეტექტორი, …“
      name: [brand, model].filter(Boolean).join(" ") + (rest ? ` — ${rest}` : ""),
      model,
      brand: brand || null,
      categoryPath: mapped?.path ?? [theirCategory, theirType].filter(Boolean),
      // 0 ან ცარიელი — ფასი ჯერ არ აწერია: პოზიცია ფასის გარეშე მოდის („ფასი მოთხოვნით“)
      cost: discounted ? Math.round(retail * (1 - pct / 100) * 100) / 100 : retail,
      listPrice: discounted ? retail : null,
      images: images?.length ? images : undefined,
      qty,
      status: qty > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
    });
  }
  if (!items.length) throw new Error(`${file}: ერთი პოზიციაც ვერ წავიკითხე`);
  return items;
}

/* ────────────────────────────── Google ────────────────────────────── */

type ServiceAccount = { client_email: string; private_key: string };

async function serviceAccount(): Promise<ServiceAccount | null> {
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE?.trim();
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!file && !inline) return null;
  let raw = inline ?? "";
  if (file) raw = await readFile(file, "utf8");
  else if (!raw.startsWith("{")) raw = Buffer.from(raw, "base64").toString("utf8"); // base64-ითაც შეიძლება
  const sa = JSON.parse(raw) as Partial<ServiceAccount>;
  if (!sa.client_email || !sa.private_key) throw new Error("სერვისის ანგარიშის გასაღებში client_email / private_key აკლია");
  return { client_email: sa.client_email, private_key: sa.private_key };
}

const b64url = (s: string) => Buffer.from(s).toString("base64url");

let cached: { email: string; token: string; until: number } | null = null;

/** მოკლევადიანი (1 სთ) წვდომის ტოკენი სერვისის ანგარიშის ხელმოწერით — მხოლოდ კითხვის უფლებით */
export async function accessToken(sa: ServiceAccount, http: Transport = web, now = Date.now()): Promise<string> {
  if (cached && cached.email === sa.client_email && cached.until > now + 60_000) return cached.token;
  const iat = Math.floor(now / 1000);
  const unsigned =
    b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
    "." +
    b64url(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/drive.readonly",
        aud: "https://oauth2.googleapis.com/token",
        iat,
        exp: iat + 3600,
      })
    );
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const res = await http("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }).toString(),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Google-მა წვდომა არ მოგვცა (HTTP ${res.status}) — შეამოწმე სერვისის ანგარიშის გასაღები`);
  const data = JSON.parse(body) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Google-ის პასუხში ტოკენი არ არის");
  cached = { email: sa.client_email, token: data.access_token, until: now + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

/** ტესტებისთვის — ტოკენის ქეშის გასუფთავება */
export function resetDriveAuth() {
  cached = null;
}

export function folderId(src: string | null): string {
  const s = (src ?? "").trim();
  const m = s.match(/\/folders\/([\w-]{10,})/) ?? s.match(/[?&]id=([\w-]{10,})/) ?? s.match(/^([\w-]{10,})$/);
  if (!m) throw new Error("baseUrl-ში Google Drive-ის ფოლდერის ბმული ან id უნდა ეწეროს");
  return m[1];
}

const API = "https://www.googleapis.com/drive/v3/files";

const discountFor = (map: Record<string, number> | undefined, file: string) =>
  Object.entries(map ?? {}).find(([k]) => k.toLowerCase() === file.toLowerCase())?.[1];

/** scripts/dahua-photos.mjs-ის შედეგი: { მოდელი: { images: [...] } } → მოდელი → ფოტოები */
async function loadPhotos(file: string | undefined): Promise<Record<string, string[]> | undefined> {
  if (!file?.trim()) return undefined;
  const dataDir = path.join(process.cwd(), "data");
  const full = path.normalize(path.join(process.cwd(), file));
  // მხოლოდ პროექტის data/ საქაღალდე — fieldMap-ით სერვერის სხვა ფაილი არ უნდა იკითხებოდეს
  if (!full.startsWith(dataDir + path.sep)) throw new Error("photos: ფაილი data/ საქაღალდეში უნდა იყოს");
  try {
    const raw = JSON.parse(await readFile(full, "utf8")) as Record<string, { images?: string[] }>;
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => v.images?.length).map(([k, v]) => [k, v.images!]));
  } catch {
    return undefined; // ფოტოების სია არასავალდებულოა — მის გარეშე სინქი მაინც მუშაობს
  }
}

/** ფაილების ტექსტი Drive API-დან: სერვისის ანგარიშით ან (საჯარო ფოლდერზე) API გასაღებით */
async function readViaApi(cfg: SupplierConfig, wanted: string[], http: Transport): Promise<[string, string][]> {
  const folder = folderId(cfg.baseUrl);
  const sa = await serviceAccount();
  const key = cfg.secret?.trim();
  if (!sa && !key) throw new Error("Drive-ის წვდომა გამართული არ არის — სერვერზე GOOGLE_SERVICE_ACCOUNT_FILE ან secret-ში API გასაღები");
  const headers: Record<string, string> = sa ? { Authorization: `Bearer ${await accessToken(sa, http)}` } : {};
  const auth = sa ? "" : `&key=${encodeURIComponent(key!)}`;

  const q = encodeURIComponent(`'${folder}' in parents and trashed = false`);
  const list = await http(
    `${API}?q=${q}&fields=files(id,name,modifiedTime)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true${auth}`,
    { headers }
  );
  const listBody = await list.text();
  if (!list.ok)
    throw new Error(
      list.status === 404 || list.status === 403
        ? "ფოლდერი ვერ გაიხსნა — გაზიარებულია სერვისის ანგარიშის ელფოსტაზე?"
        : `ფოლდერის სია ვერ წამოვიღე: HTTP ${list.status}`
    );
  const files = (JSON.parse(listBody) as { files?: { id: string; name: string; modifiedTime?: string }[] }).files ?? [];

  const out: [string, string][] = [];
  for (const name of wanted) {
    // ერთი სახელით რამდენიმე ფაილი (ძველი ასლი) — ყველაზე ახალი
    const file = files
      .filter((f) => f.name.toLowerCase() === name.toLowerCase())
      .sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""))[0];
    // ფაილი გაქრა — ვჩერდებით: ნაწილობრივი სია დანარჩენ პოზიციებს „გამქრალად“ ჩათვლიდა
    if (!file) throw new Error(`ფაილი „${name}“ ფოლდერში ვერ ვიპოვე (არის: ${files.map((f) => f.name).join(", ") || "არაფერი"})`);
    const res = await http(`${API}/${file.id}?alt=media&supportsAllDrives=true${auth}`, { headers });
    const text = await res.text();
    if (!res.ok) throw new Error(`„${name}“ ვერ ჩამოვტვირთე: HTTP ${res.status}`);
    out.push([name, text]);
  }
  return out;
}

/** Apps Script-ის ვებ-აპი (deploy/google-drive-reader.gs): baseUrl — მისი /exec ბმული, secret — გასაღები */
export const isScriptUrl = (url: string | null) => (url ?? "").trim().startsWith("https://script.google.com/macros/s/");

/**
 * ფაილების ტექსტი იმ Google ანგარიშის სკრიპტიდან, რომელსაც ფოლდერი გაზიარებული აქვს — როცა ფოლდერს
 * სხვა ვერ ვუზიარებთ (მხოლოდ ნახვის უფლება გვაქვს). გასაღები მოთხოვნის ტანში მიდის და არა მისამართში.
 */
async function readViaScript(cfg: SupplierConfig, wanted: string[], http: Transport): Promise<[string, string][]> {
  const token = cfg.secret?.trim();
  if (!token) throw new Error("secret-ში სკრიპტის გასაღები სჭირდება");
  const out: [string, string][] = [];
  for (const name of wanted) {
    const res = await http(cfg.baseUrl!.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, file: name }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`„${name}“ ვერ წამოვიღე: HTTP ${res.status}`);
    let data: { text?: string; error?: string };
    try {
      data = JSON.parse(body);
    } catch {
      // Google-მა შესვლის ან შეცდომის გვერდი დააბრუნა — სკრიპტი „ყველასთვის“ არ არის გაშვებული ან ბმული შეიცვალა
      throw new Error("სკრიპტმა JSON არ დააბრუნა — შეამოწმე ვებ-აპის ბმული და წვდომა (Anyone)");
    }
    if (data.error === "forbidden") throw new Error("სკრიპტმა გასაღები არ მიიღო — secret არ ემთხვევა");
    if (data.error || typeof data.text !== "string") throw new Error(`„${name}“: ${data.error ?? "ტექსტი არ მოვიდა"}`);
    out.push([name, data.text]);
  }
  return out;
}

export async function fetchDriveItems(cfg: SupplierConfig, http: Transport = web): Promise<SupplierItem[]> {
  const map = (cfg.fieldMap?.trim() ? JSON.parse(cfg.fieldMap) : {}) as FieldMap;
  const wanted = (map.files ?? []).map((f) => f.trim()).filter(Boolean);
  if (!wanted.length) throw new Error('fieldMap-ში ფაილების სახელები სჭირდება: {"files": ["….csv"]}');

  const texts = isScriptUrl(cfg.baseUrl) ? await readViaScript(cfg, wanted, http) : await readViaApi(cfg, wanted, http);
  const photos = await loadPhotos(map.photos);
  const items: SupplierItem[] = [];
  const seen = new Set<string>();
  for (const [name, text] of texts) {
    const opts: ParseOptions = {
      brands: map.brands,
      categories: map.categories,
      discount: discountFor(map.discounts, name),
      rules: map.discountRules,
      photos,
      skuPrefix: map.skuPrefix,
    };
    for (const item of parseDriveCsv(text, name, opts)) {
      if (seen.has(item.supplierSku)) continue; // ერთი კოდი ორ ფაილში — პირველი რჩება
      seen.add(item.supplierSku);
      items.push(item);
    }
  }
  return items;
}

export const gdriveCsv: SupplierAdapter = { fetchItems: (cfg) => fetchDriveItems(cfg) };
