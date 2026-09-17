import type { SupplierAdapter, SupplierConfig, SupplierItem } from "./types";
import { authHeaders, requestUrl } from "./types";

/**
 * REST/JSON-ის მომცემი კომპანიისთვის კოდი აღარ იწერება — fieldMap ეუბნება,
 * სად ძევს სია და რომელი ველი რას ნიშნავს:
 *
 * {
 *   "listPath": "data.items",
 *   "sku": "code", "name": "title", "cost": "price", "qty": "balance",
 *   "brand": "manufacturer", "model": "article", "category": "group",
 *   "images": "photos", "incomingDate": "eta",
 *   "imageBase": "https://partner.ge",              — ფარდობითი სურათის მისამართის წინ
 *   "categoryPath": ["category", "sub", "child"],   — რამდენიმე ველიდან აწყობილი გზა
 *   "attributes": "variations",                     — {სახელი: მნიშვნელობა | [მნიშვნელობა]} ან [{name, value}]
 *   "available": "is_available",                    — false → ნაშთი ნულად, რაც უნდა ეწეროს qty-ში
 *   "listPrice": "retail_price"                     — მიმწოდებლის საცალო ფასი, თუ ცალკე იძლევა
 * }
 */
type FieldMap = Record<string, unknown> & {
  listPath?: string;
  imageBase?: string;
  categoryPath?: string | string[];
};

const s = (map: FieldMap, key: string, fallback: string): string =>
  typeof map[key] === "string" ? (map[key] as string) : fallback;

/** კატეგორიის გზა: ერთი ველი "A > B" ან რამდენიმე ველი თანმიმდევრობით; მასივები იშლება */
function categoryPath(raw: unknown, map: FieldMap): string[] | undefined {
  if (Array.isArray(map.categoryPath)) {
    const out: string[] = [];
    for (const f of map.categoryPath) {
      const v = pick(raw, f);
      for (const part of Array.isArray(v) ? v : [v]) {
        const t = str(part)?.trim();
        if (t) out.push(t);
      }
    }
    return out.length ? out : undefined;
  }
  const single = str(pick(raw, s(map, "category", "category")));
  return single ? single.split(/\s*[>/|]\s*/).filter(Boolean) : undefined;
}

function attributes(raw: unknown, map: FieldMap): { name: string; value: string }[] | undefined {
  const key = s(map, "attributes", "");
  if (!key) return undefined;
  const v = pick(raw, key);
  const out: { name: string; value: string }[] = [];
  if (Array.isArray(v)) {
    for (const a of v as Record<string, unknown>[]) {
      const name = str(a?.name)?.trim();
      const value = str(a?.value)?.trim();
      if (name && value) out.push({ name, value });
    }
  } else if (v && typeof v === "object") {
    for (const [name, val] of Object.entries(v as Record<string, unknown>)) {
      const value = (Array.isArray(val) ? val : [val]).map(str).filter(Boolean).join(", ");
      if (name.trim() && value) out.push({ name: name.trim(), value });
    }
  }
  return out.length ? out : undefined;
}

/** "data.items" → ჩალაგებული ველის ამოღება */
function pick(obj: unknown, path?: string): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const genericRest: SupplierAdapter = {
  async fetchItems(cfg: SupplierConfig): Promise<SupplierItem[]> {
    if (!cfg.baseUrl) throw new Error("baseUrl მითითებული არ არის");
    const map: FieldMap = cfg.fieldMap ? (JSON.parse(cfg.fieldMap) as FieldMap) : {};

    const res = await fetch(requestUrl(cfg), {
      headers: { Accept: "application/json", ...authHeaders(cfg) },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const body: unknown = await res.json();
    const rawList = map.listPath ? pick(body, map.listPath) : body;
    if (!Array.isArray(rawList)) {
      throw new Error(
        `სია ვერ მოიძებნა${map.listPath ? ` გზაზე "${map.listPath}"` : ""} — შეამოწმე fieldMap.listPath`
      );
    }

    const imageBase = (map.imageBase ?? "").replace(/\/+$/, "");
    const absolute = (u: string) =>
      /^https?:\/\//i.test(u) || !imageBase ? u : imageBase + (u.startsWith("/") ? "" : "/") + u;

    const items: SupplierItem[] = [];
    for (const raw of rawList as Record<string, unknown>[]) {
      const sku = str(pick(raw, s(map, "sku", "sku")));
      const name = str(pick(raw, s(map, "name", "name")));
      if (!sku || !name) continue; // კოდისა და დასახელების გარეშე ჩანაწერს ვერსად მივაბამთ

      const rawImages = pick(raw, s(map, "images", "images"));
      const images = (
        Array.isArray(rawImages)
          ? rawImages.map((x) => str(x)).filter((x): x is string => Boolean(x))
          : typeof rawImages === "string" && rawImages
            ? [rawImages]
            : []
      ).map(absolute);

      const eta = str(pick(raw, s(map, "incomingDate", "incomingDate")));

      // „ხელმისაწვდომია: არა“ ნაშთის ციფრზე მაღლა დგას — კომპანიამ იცის, რატომ დაბლოკა
      const availKey = s(map, "available", "");
      const blocked = availKey ? pick(raw, availKey) === false : false;
      const qty = blocked ? 0 : (numOrNull(pick(raw, s(map, "qty", "qty"))) ?? 0);

      items.push({
        supplierSku: sku,
        name,
        model: str(pick(raw, s(map, "model", "model"))),
        brand: str(pick(raw, s(map, "brand", "brand"))),
        description: str(pick(raw, s(map, "description", "description"))),
        categoryPath: categoryPath(raw, map),
        cost: numOrNull(pick(raw, s(map, "cost", "price"))),
        listPrice: numOrNull(pick(raw, s(map, "listPrice", "listPrice"))),
        qty,
        status: str(pick(raw, s(map, "status", "status"))),
        incomingDate: eta && !Number.isNaN(Date.parse(eta)) ? new Date(eta) : null,
        weightKg: numOrNull(pick(raw, s(map, "weightKg", "weight"))),
        volumeM3: numOrNull(pick(raw, s(map, "volumeM3", "volume"))),
        warrantyMonths: numOrNull(pick(raw, s(map, "warrantyMonths", "warranty"))),
        images,
        attributes: attributes(raw, map),
      });
    }
    return items;
  },
};
