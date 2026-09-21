import { readdir, readFile } from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
import { getRate } from "../fx";
import type { SupplierAdapter, SupplierConfig, SupplierItem } from "./types";

/**
 * მიმწოდებელი, რომელსაც API არ აქვს და ფასთა ნუსხას Excel-ით გზავნის.
 * ფაილი ადმინიდან იტვირთება (data/pricelists/<slug>.xlsx) ან ბმულით მოდის (baseUrl = https://…).
 *
 * fieldMap — ფურცლების აღწერა, რადგან ერთ ფაილში რამდენიმე მიმწოდებელი/ბრენდი შეიძლება იყოს:
 * {
 *   "skuStrip": "/GE",                 — SKU-ს ბოლოდან მოსაშორებელი; მოდელი ამის მერე რჩება
 *   "sheets": {
 *     "BLUETTI": { "brand": "Bluetti", "category": ["ენერგო უზრუნველყოფა", "პორტატული ელსადგურები"],
 *                  "columns": { "sku": 0, "name": 1, "cost": 2, "qty": 3 } },
 *     "DELTA":   { "brand": "Delta Electronics", "category": ["ენერგო უზრუნველყოფა"],
 *                  "columns": { "sku": 0, "name": 1, "cost": 2 }, "sectionRows": true, "rate": 1 },
 *     "Perkins": { "brand": "ZEN", "category": ["…", "დიზელის გენერატორები", "Perkins ძრავით"],
 *                  "skipRows": 2, "columns": { "sku": 0, "cost": 2 },
 *                  "currency": "EUR",                          — ლარში ეროვნული ბანკის დღიური კურსით
 *                  "nameTemplate": "დიზელ-გენერატორი {0} — {1} kVA",
 *                  "attributes": { "სიმძლავრე Stand-by": "{1} kVA", "ძრავი": "Perkins" },
 *                  "preorder": true,                            — ნაშთი არ გვაქვს, მხოლოდ შეკვეთით
 *                  "docsDir": "generators/perkins" }           — public/uploads/docs/<dir>/<მოდელი>*.pdf
 *   }
 * }
 * sectionRows: სტრიქონი ცარიელი SKU-თი და სახელით („UPS“, „Battery Pack“) განყოფილებაა —
 *   მომდევნო პროდუქტების კატეგორია სახელს ემატება. rate: ფასის კოეფიციენტი (currency-ს გარდა).
 *   rules: [{ "contains": "Expansion Battery", "category": [...] }] — სახელის მიხედვით კატეგორია.
 *   qty სვეტი რომ არ იყოს — ნაშთი 0, სტატუსი წინასწარი შეკვეთა. {n} შაბლონში n-ური სვეტია.
 */
type SheetSpec = {
  brand?: string;
  category?: string[];
  columns: { sku: number; name?: number; cost?: number; qty?: number; model?: number };
  sectionRows?: boolean;
  rate?: number;
  currency?: string;
  skipRows?: number;
  nameTemplate?: string;
  attributes?: Record<string, string>;
  preorder?: boolean;
  docsDir?: string;
  rules?: { contains: string; category: string[] }[];
};
type Map = { sheets: Record<string, SheetSpec>; skuStrip?: string };

export const PRICELIST_DIR = path.join(process.cwd(), "data", "pricelists");
export const pricelistPath = (slug: string) => path.join(PRICELIST_DIR, `${slug}.xlsx`);
const DOCS_ROOT = path.join(process.cwd(), "public", "uploads", "docs");

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
  const clean = v.replace(/[^\d.,-]/g, "").replace(",", ".");
  if (!clean) return null; // ცარიელი უჯრა ნული არ არის
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
};
/** "{0} — {1} kVA" → სვეტების მნიშვნელობებით; ციფრი მთელი ან ორი ათწილადით */
const fill = (tpl: string, row: unknown[]) =>
  tpl.replace(/\{(\d+)\}/g, (_, i) => {
    const v = cell(row, Number(i));
    const n = Number(v);
    return Number.isFinite(n) && v !== "" ? String(Math.round(n * 100) / 100) : v;
  });

/** „ZEN 17 TBI“ → „zen-17-tbi“ — ფაილის სახელთან შესადარებლად */
const fileKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** docsDir-ის ფაილები ერთხელ იკითხება; მოდელს ემთხვევა ფაილი, რომლის სახელი მოდელით იწყება */
async function listDocs(dir: string): Promise<string[]> {
  try {
    return (await readdir(path.join(DOCS_ROOT, dir))).filter((f) => /\.pdf$/i.test(f) && !f.startsWith("."));
  } catch {
    return [];
  }
}
function docsFor(model: string, files: string[], dir: string) {
  const key = fileKey(model);
  return files
    .filter((f) => {
      const k = fileKey(f.replace(/\.pdf$/i, ""));
      return k === key || k.startsWith(key + "-") || k.startsWith(key + "_");
    })
    .map((f) => ({ title: "ტექნიკური დოკუმენტაცია (datasheet)", url: `/uploads/docs/${dir}/${f}` }));
}

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
      // ვალუტა → ლარი ეროვნული ბანკის კურსით; rate ზემოდან ედება (მაგ. ტრანსპორტი +3%)
      const fx = spec.currency ? (await getRate(spec.currency)).rate : 1;
      const rate = (spec.rate ?? 1) * fx;
      const docFiles = spec.docsDir ? await listDocs(spec.docsDir) : [];
      let section: string | null = null;

      for (const row of rows.slice(spec.skipRows ?? 0)) {
        const sku = cell(row, spec.columns.sku);
        const rawName = spec.columns.name !== undefined ? cell(row, spec.columns.name) : "";
        if (!sku && rawName && spec.sectionRows) { section = rawName; continue; }
        if (!sku) continue;
        const name = spec.nameTemplate ? fill(spec.nameTemplate, row) : rawName;
        if (!name) continue;

        const cost = spec.columns.cost !== undefined ? num(cell(row, spec.columns.cost)) : null;
        if (spec.columns.cost !== undefined && cost === null) continue; // ფასის გარეშე სტრიქონი სათაურია
        const qtyRaw = spec.columns.qty !== undefined ? num(cell(row, spec.columns.qty)) : null;
        const qty = spec.preorder ? 0 : (qtyRaw ?? 0);
        const modelCol = spec.columns.model !== undefined ? cell(row, spec.columns.model) : "";
        const model = modelCol || (map.skuStrip ? sku.replace(map.skuStrip, "") : sku);

        const rule = spec.rules?.find((r) => name.toLowerCase().includes(r.contains.toLowerCase()));
        const attributes = spec.attributes
          ? Object.entries(spec.attributes)
              .map(([n, tpl]) => ({ name: n, value: fill(tpl, row) }))
              .filter((a) => a.value && !/^\s*(kVA|kW)?\s*$/.test(a.value))
          : undefined;

        items.push({
          supplierSku: sku,
          name,
          model,
          brand: spec.brand ?? null,
          categoryPath: rule ? rule.category : [...(spec.category ?? []), ...(section ? [section] : [])],
          cost: cost !== null ? Math.round(cost * rate * 100) / 100 : null,
          qty,
          // ნაშთის სვეტი არ აქვს ან „მხოლოდ შეკვეთით“ — წინასწარი შეკვეთა, არა „არ გვაქვს“
          status: spec.preorder || qtyRaw === null ? "PREORDER" : qty > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
          attributes,
          documents: spec.docsDir ? docsFor(model, docFiles, spec.docsDir) : undefined,
        });
      }
    }
    return items;
  },
};
