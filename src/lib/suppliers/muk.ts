import { XMLParser } from "fast-xml-parser";
import { getRate } from "../fx";
import { authHeaders, requestUrl, type SupplierAdapter, type SupplierConfig, type SupplierItem } from "./types";

/**
 * MUK — XML ფასთა ნუსხა (api.muk.ge/<გასაღები>/XML/PRICE).
 *
 * ორ რამეს ითვალისწინებს:
 *  • ფასები დოლარშია. კურსს თვითონ MUK იძლევა (/XML/CURRENCY, პირველი VALUE
 *    დღევანდელია) — სწორედ იმით ითვლება ანგარიში, ამიტომ ის გვჭირდება და არა
 *    ეროვნული ბანკისა. თუ ვერ წამოვიღეთ, NBG-ის კურსი ჩაენაცვლება.
 *  • წვდომა IP-ითაა შეზღუდული: სინქი სერვერიდან მუშაობს, ლოკალურად — არა.
 *
 * fieldMap (არასავალდებულო):
 * {
 *   "categories": { "Network equipment/Switch": ["LAN & WAN", "სვიჩები (LAN)"], "UPS": ["ენერგო უზრუნველყოფა", "უწყვეტი კვების წყაროები UPS"] },
 *                    — გასაღები „CATEGORY/KOD2" კონკრეტულია და უპირატესია „CATEGORY"-ზე
 *   "skipCategories": ["Medical"],
 *   "rate": 1.03            — ტრანსპორტი/საკომისიო კურსზე ზემოდან
 * }
 */

type Map = {
  categories?: Record<string, string[]>;
  skipCategories?: string[];
  rate?: number;
};

type Node = Record<string, unknown>;
const text = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const num = (v: unknown): number | null => {
  const n = Number(text(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);

/** „In Stock“ / „Coming Soon“ / „Available upon request“ / „Reserve“ */
function statusOf(status: string, qty: number): string {
  const s = status.toLowerCase();
  if (s.includes("coming")) return "IN_TRANSIT";
  if (s.includes("request")) return "PREORDER";
  if (s.includes("reserve")) return "OUT_OF_STOCK";
  return qty > 0 ? "IN_STOCK" : "OUT_OF_STOCK";
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  trimValues: true,
  parseTagValue: false, // ფასი და კოდი ტექსტად უნდა დარჩეს
});

/** MUK-ის დღევანდელი კურსი; ჩავარდნისას — ეროვნული ბანკის */
async function usdRate(cfg: SupplierConfig): Promise<number> {
  const url = requestUrl(cfg).replace(/\/PRICE\b.*$/, "/CURRENCY");
  try {
    const res = await fetch(url, { headers: authHeaders(cfg), cache: "no-store" });
    if (res.ok) {
      const doc = parser.parse(await res.text()) as Node;
      const values = list((doc.CURRENCY as Node)?.VALUE);
      const first = values[0] as Node | string | undefined;
      const rate = num(typeof first === "object" && first ? first["#text"] : first);
      if (rate && rate > 0.5) return rate;
    }
  } catch {
    /* ქვემოთ NBG-ზე გადავდივართ */
  }
  return (await getRate("USD")).rate;
}

export const muk: SupplierAdapter = {
  async fetchItems(cfg: SupplierConfig): Promise<SupplierItem[]> {
    const map: Map = cfg.fieldMap?.trim() ? (JSON.parse(cfg.fieldMap) as Map) : {};
    const res = await fetch(requestUrl(cfg), { headers: authHeaders(cfg), cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    if (xml.includes("<ERROR_LIST>")) {
      const msg = xml.match(/<ERROR_\d+>([^<]*)</)?.[1] ?? "უცნობი შეცდომა";
      throw new Error(`MUK: ${msg}`);
    }

    const doc = parser.parse(xml) as Node;
    const products = list((doc.PRICE as Node)?.Product);
    if (!products.length) throw new Error("XML-ში პროდუქტები არ არის");

    const rate = (await usdRate(cfg)) * (map.rate ?? 1);
    const skip = new Set(map.skipCategories ?? []);
    const items: SupplierItem[] = [];

    for (const raw of products) {
      const p = raw as Node;
      const sku = text(p.VENDOR_PART_NUMBER);
      const name = text(p.NAME) || text(p.FULL_NAME);
      if (!sku || !name) continue;

      const category = text(p.CATEGORY);
      if (skip.has(category)) continue;

      const qty = Math.max(0, num(p.QUANTITY) ?? 0);
      const dealer = num(p.PRICE_DILER);
      const retail = num(p.PRICE_RETAIL);

      // მიმწოდებლის კატეგორია ინგლისურია — რუკით ვთარგმნით: ჯერ „CATEGORY/KOD2“
      // (კონკრეტული), მერე „CATEGORY“. თუ არცერთია, ისე გადავცემთ და სინქი
      // დაუკატეგორიებელში ჩააგდებს.
      const kod2 = text(p.KOD2);
      const mapped = map.categories?.[`${category}/${kod2}`] ?? map.categories?.[category];
      const path = mapped ?? [category, kod2, text(p.KOD3)].filter(Boolean);

      const attributes = list((p.ADDITIONAL_PROPERTIES as Node)?.PROPERTY)
        .map((a) => {
          const node = a as Node;
          return { name: text(node["@type"]), value: text(node["#text"] ?? (typeof a === "string" ? a : "")) };
        })
        .filter((a) => a.name && a.value);

      const images = list((p.IMAGES as Node)?.IMAG)
        .map((i) => text(typeof i === "object" && i ? (i as Node)["#text"] : i))
        .filter((u) => /^https?:\/\//.test(u));

      items.push({
        supplierSku: sku,
        name,
        model: text(p.MODEL) || sku,
        brand: text(p.VENDOR) || null,
        categoryPath: path,
        description: text(p.DESCRIPTION) || null,
        cost: dealer !== null ? Math.round(dealer * rate * 100) / 100 : null,
        listPrice: retail !== null ? Math.round(retail * rate * 100) / 100 : null,
        qty,
        status: statusOf(text(p.STATUS), qty),
        images,
        attributes,
        weightKg: num(p.WEIGHT) || null,
        warrantyMonths: num(p.WARRANTY) || null,
      });
    }

    return items;
  },
};
