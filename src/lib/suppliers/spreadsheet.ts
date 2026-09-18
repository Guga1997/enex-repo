import { readFile } from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
import type { SupplierAdapter, SupplierConfig, SupplierItem } from "./types";

/**
 * მიმწოდებელი, რომელსაც API არ აქვს და ფასთა ნუსხას Excel-ით გზავნის.
 * ფაილი ადმინიდან იტვირთება (data/pricelists/<slug>.xlsx) ან ბმულით მოდის (baseUrl = https://…).
 *
 * fieldMap — ფურცლების აღწერა, რადგან ერთ ფაილში რამდენიმე მიმწოდებელი/ბრენდი შეიძლება იყოს:
 * {
 *   "sheets": {
 *     "BLUETTI": { "brand": "Bluetti", "category": ["ენერგო უზრუნველყოფა", "პორტატული ელსადგურები"],
 *                  "columns": { "sku": 0, "name": 1, "cost": 2, "qty": 3 } },
 *     "DELTA":   { "brand": "Delta Electronics", "category": ["ენერგო უზრუნველყოფა"],
 *                  "columns": { "sku": 0, "name": 1, "cost": 2 }, "sectionRows": true, "rate": 1 }
 *   },
 *   "skuStrip": "/GE"        — SKU-ს ბოლოდან მოსაშორებელი; მოდელი ამის მერე რჩება
 * }
 * rules (ფურცელზე): [{ "contains": "Expansion Battery", "category": ["…", "დამატებითი აკუმულატორები"] }]
 *
 * sectionRows: სტრიქონი ცარიელი SKU-თი და სახელით („UPS“, „Battery Pack“) განყოფილებაა —
 *   მომდევნო პროდუქტების კატეგორია სახელს ემატება. rate: ფასის გამრავლების კოეფიციენტი
 *   (მაგ. დოლარიდან ლარში), ნაგულისხმევად 1. qty რომ არ იყოს — ნაშთი 0, სტატუსი წინასწარი შეკვეთა.
 */
type SheetSpec = {
  brand?: string;
  category?: string[];
  columns: { sku: number; name: number; cost?: number; qty?: number; model?: number };
  sectionRows?: boolean;
  rate?: number;
  skipRows?: number;
  /** სახელის მიხედვით კატეგორია: პირველი დამთხვევა იგებს, სხვაგვარად — ფურცლის კატეგორია */
  rules?: { contains: string; category: string[] }[];
};
type Map = { sheets: Record<string, SheetSpec>; skuStrip?: string };

export const PRICELIST_DIR = path.join(process.cwd(), "data", "pricelists");
export const pricelistPath = (slug: string) => path.join(PRICELIST_DIR, `${slug}.xlsx`);

async function loadWorkbook(cfg: SupplierConfig): Promise<XLSX.WorkBook> {
  const src = cfg.baseUrl?.trim();
  if (src && /^https?:\/\//i.test(src)) {
    const res = await fetch(src, { cache: "no-store" });
    if (!res.ok) throw new Error(`ფაილი ვერ ჩამოიტვირთა: HTTP ${res.status}`);
    return XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer" });
  }
  try {
    return XLSX.read(await readFile(pricelistPath(cfg.slug)), { type: "buffer" });
  } catch {
    throw new Error("ფასთა ნუსხა ატვირთული არ არის — რედაქტირებაში Excel-ი ატვირთე");
  }
}

const cell = (row: unknown[], i: number | undefined) =>
  i === undefined || i < 0 ? "" : String(row[i] ?? "").trim();
const num = (v: string) => {
  const n = Number(v.replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const spreadsheet: SupplierAdapter = {
  async fetchItems(cfg: SupplierConfig): Promise<SupplierItem[]> {
    if (!cfg.fieldMap?.trim()) throw new Error("fieldMap-ში ფურცლების აღწერა სჭირდება");
    const map = JSON.parse(cfg.fieldMap) as Map;
    const wb = await loadWorkbook(cfg);
    const items: SupplierItem[] = [];

    for (const [sheetName, spec] of Object.entries(map.sheets)) {
      const ws = wb.Sheets[sheetName];
      if (!ws) throw new Error(`ფურცელი „${sheetName}“ ფაილში არ არის (არის: ${wb.SheetNames.join(", ")})`);
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
      const rate = spec.rate ?? 1;
      let section: string | null = null;

      for (const row of rows.slice(spec.skipRows ?? 0)) {
        const sku = cell(row, spec.columns.sku);
        const name = cell(row, spec.columns.name);
        if (!sku && name && spec.sectionRows) { section = name; continue; }
        if (!sku || !name) continue;

        const cost = spec.columns.cost !== undefined ? num(cell(row, spec.columns.cost)) : null;
        const qtyRaw = spec.columns.qty !== undefined ? num(cell(row, spec.columns.qty)) : null;
        const qty = qtyRaw ?? 0;
        const modelCol = spec.columns.model !== undefined ? cell(row, spec.columns.model) : "";
        const model = modelCol || (map.skuStrip ? sku.replace(map.skuStrip, "") : sku);

        const rule = spec.rules?.find((r) => name.toLowerCase().includes(r.contains.toLowerCase()));
        items.push({
          supplierSku: sku,
          name,
          model,
          brand: spec.brand ?? null,
          categoryPath: rule ? rule.category : [...(spec.category ?? []), ...(section ? [section] : [])],
          cost: cost !== null ? Math.round(cost * rate * 100) / 100 : null,
          qty,
          // ნაშთის სვეტი არ აქვს? — შეკვეთით მოაქვს, არა „არ გვაქვს“
          status: qtyRaw === null ? "PREORDER" : qty > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
        });
      }
    }
    return items;
  },
};
