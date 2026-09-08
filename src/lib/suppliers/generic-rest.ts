import type { SupplierAdapter, SupplierConfig, SupplierItem } from "./types";
import { authHeaders } from "./types";

/**
 * REST/JSON-ის მომცემი კომპანიისთვის კოდი აღარ იწერება — fieldMap ეუბნება,
 * სად ძევს სია და რომელი ველი რას ნიშნავს:
 *
 * {
 *   "listPath": "data.items",
 *   "sku": "code", "name": "title", "cost": "price", "qty": "balance",
 *   "brand": "manufacturer", "model": "article", "category": "group",
 *   "images": "photos", "incomingDate": "eta"
 * }
 */
type FieldMap = Record<string, string> & { listPath?: string };

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

    const res = await fetch(cfg.baseUrl, {
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

    const items: SupplierItem[] = [];
    for (const raw of rawList as Record<string, unknown>[]) {
      const sku = str(pick(raw, map.sku ?? "sku"));
      const name = str(pick(raw, map.name ?? "name"));
      if (!sku || !name) continue; // კოდისა და დასახელების გარეშე ჩანაწერს ვერსად მივაბამთ

      const rawImages = pick(raw, map.images ?? "images");
      const images = Array.isArray(rawImages)
        ? rawImages.map((x) => str(x)).filter((x): x is string => Boolean(x))
        : typeof rawImages === "string" && rawImages
          ? [rawImages]
          : [];

      const eta = str(pick(raw, map.incomingDate ?? "incomingDate"));
      const category = str(pick(raw, map.category ?? "category"));

      items.push({
        supplierSku: sku,
        name,
        model: str(pick(raw, map.model ?? "model")),
        brand: str(pick(raw, map.brand ?? "brand")),
        description: str(pick(raw, map.description ?? "description")),
        categoryPath: category ? category.split(/\s*[>/|]\s*/).filter(Boolean) : undefined,
        cost: numOrNull(pick(raw, map.cost ?? "price")),
        qty: numOrNull(pick(raw, map.qty ?? "qty")) ?? 0,
        status: str(pick(raw, map.status ?? "status")),
        incomingDate: eta && !Number.isNaN(Date.parse(eta)) ? new Date(eta) : null,
        weightKg: numOrNull(pick(raw, map.weightKg ?? "weight")),
        volumeM3: numOrNull(pick(raw, map.volumeM3 ?? "volume")),
        warrantyMonths: numOrNull(pick(raw, map.warrantyMonths ?? "warranty")),
        images,
      });
    }
    return items;
  },
};
