import { request } from "node:https";
import type { SupplierAdapter, SupplierConfig, SupplierItem } from "./types";
import { modelFromName } from "./intelectro";

/**
 * Elvare Catalog — Partner API (webapi.elvare.ge/ext/v1), მხოლოდ კითხვა.
 *
 *   POST /token        {login, password} → access_token (3600 წმ)
 *   GET  /categories   ხე: id, name, parent_id ("" = ძირი)
 *   GET  /brands       id → name
 *   GET  /products     გვერდებად (page_size ≤ 1000), მხოლოდ მარაგში მყოფი
 *
 * baseUrl  → https://webapi.elvare.ge/ext/v1
 * secret   → „login:password“ (ერთ ველში, ორწერტილით)
 *
 * მოთხოვნას მხოლოდ რეგისტრირებული IP-დან იღებს (403 ip_not_allowed). რეგისტრირებულია
 * სერვერის IPv4, ამიტომ მხოლოდ IPv4-ით ვუკავშირდებით — fetch IPv6-ს ირჩევს და უარს იღებს.
 * ორ ფასს აგზავნის: dealer_price ჩვენი თვითღირებულებაა, price — მათი საცალო.
 */

type ElvCategory = { id: string; name: string; parent_id?: string | null };
type ElvProduct = {
  id?: string;
  sku?: string;
  name?: string;
  category_id?: string | null;
  brand_id?: string | null;
  price?: number | null;
  dealer_price?: number | null;
  currency?: string | null;
  in_stock?: boolean;
  quantity?: number | null;
  images?: string[] | null;
};
type Page<T> = { items?: T[]; page?: number; total_pages?: number };

const PAGE_SIZE = 1000;
const MAX_PAGES = 50; // 50 000 პოზიცია — დაცვა უსასრულო ციკლისგან, თუ total_pages არ მოვიდა

function credentials(cfg: SupplierConfig): { login: string; password: string } {
  const s = cfg.secret ?? "";
  const i = s.indexOf(":");
  if (i <= 0) throw new Error("secret ფორმატში login:password უნდა იყოს");
  return { login: s.slice(0, i), password: s.slice(i + 1) };
}

type Init = { method?: string; headers?: Record<string, string>; body?: string };
type Res = { ok: boolean; status: number; text(): Promise<string> };
export type Transport = (url: string, init: Init) => Promise<Res>;

/** HTTPS მხოლოდ IPv4-ით */
const ipv4: Transport = (url, init) =>
  new Promise((resolve, reject) => {
    const req = request(url, { method: init.method ?? "GET", headers: init.headers, family: 4, timeout: 60_000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const status = res.statusCode ?? 0;
        const body = Buffer.concat(chunks).toString("utf8");
        resolve({ ok: status >= 200 && status < 300, status, text: async () => body });
      });
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Elvare: პასუხი არ მოვიდა 60 წამში")));
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });

async function call<T>(send: Transport, url: string, init: Init): Promise<T> {
  const res = await send(url, init);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* ქვემოთ — შეცდომის ტექსტით */
  }
  if (!res.ok) {
    const code = (body as { error?: string } | null)?.error ?? text.slice(0, 80);
    const hint =
      code === "ip_not_allowed" ? " — სერვერის IP Elvare-ში რეგისტრირებული არ არის"
      : code === "catalog_warming_up" ? " — კატალოგი მზადდება, წუთში სცადე"
      : code === "invalid_credentials" ? " — login ან პაროლი არასწორია"
      : "";
    throw new Error(`Elvare ${res.status} ${code}${hint}`);
  }
  if (body === null) throw new Error(`Elvare: პასუხი JSON არ არის: ${text.slice(0, 120)}`);
  return body as T;
}

/** კატეგორიის სრული გზა ძირიდან: ["კაბელები", "ძალოვანი კაბელები"] */
export function categoryPaths(cats: ElvCategory[]): Map<string, string[]> {
  const byId = new Map(cats.map((c) => [c.id, c]));
  const out = new Map<string, string[]>();
  const pathOf = (id: string, seen = new Set<string>()): string[] => {
    const hit = out.get(id);
    if (hit) return hit;
    const c = byId.get(id);
    if (!c || seen.has(id)) return [];
    seen.add(id);
    const parent = c.parent_id ? pathOf(c.parent_id, seen) : [];
    const path = [...parent, c.name.trim()].filter(Boolean);
    out.set(id, path);
    return path;
  };
  for (const c of cats) pathOf(c.id);
  return out;
}

const E = "ენერგო უზრუნველყოფა";
const PROT = [E, "ელექტროდამცავი მოწყობილობები"];

/**
 * Elvare-ს ხე → ჩვენი ხე: მათი კატეგორიები „ენერგო უზრუნველყოფის“ ქვეშ, მათივე სახელებით.
 * რაც უკვე გვაქვს, იქ რჩება — დაბალი ძაბვის დაცვა = ჩვენი „ელექტროდამცავი მოწყობილობები“
 * (ამომრთველები, დიფ. ავტომატები, მცველები, იმპულსისგან დაცვა, გაჟონვის რელეები),
 * ქსელის კაბელი — LAN კაბელებში, სახანძრო — სახანძრო სიგნალიზაციაში.
 * გზა სრულია ძირიდან: სახელით ვერ ვეძებთ — მათი „კედლის კარადები“ ელ. კარადაა, ჩვენი — ქსელის.
 * ახალი კატეგორიები: scripts/elvare-categories.ts.
 */
export function ourCategoryPath(path: string[] | undefined): string[] | undefined {
  if (!path?.length) return undefined;
  const [top, ...rest] = path;
  if (top === "დაბალი ძაბვის დაცვის მოწყობილობები") {
    const [mid, leaf = ""] = rest;
    if (mid === "ავტომატური ამომრთველი") {
      if (leaf.startsWith("DC")) return [...PROT, "DC ავტომატური ამომრთველები"];
      if (leaf.startsWith("დიფერენციალური")) return [...PROT, "დიფერენციალური ავტომატები"];
      return [...PROT, "ავტომატური ამომრთველები", ...rest.slice(1)];
    }
    if (mid === "გადაძაბვის დამცველი") return [...PROT, "დენის იმპულსისგან დაცვა"];
    if (mid === "დნობადი მცველი") return [...PROT, "დნობადი მცველები"];
    if (leaf === "გაჟონვის რელე") return [...PROT, "გაჟონვის რელეები"];
    return [...PROT, ...rest];
  }
  if (top === "კაბელი") {
    const leaf = rest[rest.length - 1];
    if (leaf === "ქსელის კაბელები") return ["LAN & WAN", "LAN კაბელები"];
    if (leaf === "სახანძრო კაბელები") return ["უსაფრთხოების სისტემები", "სახანძრო სიგნალიზაცია", "სახანძრო კაბელი"];
  }
  return [E, ...path];
}

/** პროდუქტი → ჩვენი ფორმა; ფასის ან კოდის გარეშე, სხვა ვალუტაში — არ შემოგვაქვს */
export function toItem(
  p: ElvProduct,
  paths: Map<string, string[]>,
  brands: Map<string, string>
): SupplierItem | null {
  const sku = String(p.sku ?? "").trim();
  const name = String(p.name ?? "").replace(/\s+/g, " ").trim();
  const cost = Number(p.dealer_price) || 0;
  const list = Number(p.price) || 0;
  if (!sku || !name || (cost <= 0 && list <= 0)) return null;
  if (p.currency && p.currency.toUpperCase() !== "GEL") return null;

  const qty = Math.max(0, Math.floor(Number(p.quantity) || 0));
  return {
    supplierSku: sku,
    name,
    model: modelFromName(name),
    brand: (p.brand_id && brands.get(p.brand_id)) || null,
    categoryPath: ourCategoryPath((p.category_id && paths.get(p.category_id)) || undefined),
    cost: cost > 0 ? cost : null,
    listPrice: list > 0 ? list : null,
    qty,
    status: qty > 0 || p.in_stock ? "IN_STOCK" : "OUT_OF_STOCK",
    images: (p.images ?? []).filter((u) => /^https?:\/\//.test(u)),
  };
}

export const makeElvare = (send: Transport = ipv4): SupplierAdapter => ({
  async fetchItems(cfg: SupplierConfig): Promise<SupplierItem[]> {
    const base = (cfg.baseUrl || "https://webapi.elvare.ge/ext/v1").replace(/\/+$/, "");
    const { access_token } = await call<{ access_token: string }>(send, `${base}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(credentials(cfg)),
    });
    const get = <T>(path: string) =>
      call<T>(send, `${base}${path}`, { headers: { Authorization: `Bearer ${access_token}`, Accept: "application/json" } });

    const [cats, brandList] = await Promise.all([
      get<Page<ElvCategory>>("/categories"),
      get<Page<{ id: string; name: string }>>("/brands"),
    ]);
    const paths = categoryPaths(cats.items ?? []);
    const brands = new Map((brandList.items ?? []).map((b) => [b.id, b.name.trim()]));

    const items: SupplierItem[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const body = await get<Page<ElvProduct>>(`/products?page=${page}&page_size=${PAGE_SIZE}`);
      for (const p of body.items ?? []) {
        const item = toItem(p, paths, brands);
        if (item) items.push(item);
      }
      if (!body.items?.length || page >= (body.total_pages ?? page)) break;
    }
    return items;
  },
});

export const elvare = makeElvare();
