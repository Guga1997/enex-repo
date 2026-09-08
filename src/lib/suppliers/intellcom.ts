import type { SupplierAdapter, SupplierConfig, SupplierItem } from "./types";

/**
 * intellcom.net-ის ვებ-სერვისი, ვერსია 1.4.
 *
 *   https://intellcom.net/ws/v1.4/products/{key}/{საიდ.კოდი}/{პროდუქტის კოდი}
 *
 * baseUrl  → .../ws/v1.4/products  (გასაღების გარეშე)
 * secret   → ვებ-სერვისის გასაღები
 * fieldMap → {"identificationCode": "405123456"}
 *
 * საიდენტიფიკაციო კოდის გარეშე სერვისი მუშაობს, მაგრამ სადილერო ფასს არ აბრუნებს —
 * price_partner ნულით მოდის. ამიტომ კოდი პრაქტიკულად სავალდებულოა.
 *
 * ⚠ სურათებისა და დოკუმენტების URL-ები hotlink-ს არ უშვებს — ფაილები ჩვენთან
 * უნდა ჩამოვტვირთოთ. ეს სინქის შემდეგი ნაბიჯია, ადაპტერი მისამართებს გადმოსცემს.
 */

const STATUS: Record<number, string> = {
  0: "წარმატებული მომართვა",
  1: "მონაცემები ვერ მოიძებნა",
  2: "არასწორი IP მისამართიდან მომართვა — დაამატე სერვერის IP დაშვებულებში",
  3: "არასწორი ვებ-სერვისის გასაღები",
  4: "არასწორი URL",
  5: "არასწორი საიდენტიფიკაციო კოდი",
  6: "არასწორი პროდუქტის კოდი",
  7: "პროდუქტების სია ცარიელია",
};

type Localized = { ka?: string; en?: string };
type Feature = { title?: string; value?: string };

type IcProduct = {
  id?: number | string;
  code_id?: string;
  title?: Localized;
  brand_name?: string;
  name?: string;
  categories?: { category_id?: number | string }[];
  price?: string | number;
  price_partner?: string | number;
  description?: Localized;
  description_text?: Localized;
  features?: { ka?: Feature[]; en?: Feature[] };
  images?: string[];
  in_stock?: boolean;
  by_order?: boolean;
  warranty_day?: string | number;
  left_qty?: string | number;
  weight?: string | number;
  volume?: string | number;
  documents?: { ka?: { name?: string; file?: string }; en?: { name?: string; file?: string } }[];
};

type IcCategory = {
  id?: string | number;
  category_name_ka?: string;
  category_name_en?: string;
  sub_category?: Record<string, IcCategory> | IcCategory[];
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** left_qty სტრიქონია და „10+“-ის სახითაც მოდის — ციფრებს ვიღებთ */
export function parseQty(v: unknown): number {
  if (typeof v === "number") return Math.max(0, Math.trunc(v));
  const m = String(v ?? "").match(/\d+/);
  return m ? Number(m[0]) : 0;
}

/** კატეგორიის ხე → id-ის მიხედვით სახელების გზა ["ენერგო უზრუნველყოფა", "UPS"] */
export function flattenCategories(
  node: IcCategory | Record<string, IcCategory> | undefined,
  trail: string[] = [],
  out = new Map<string, string[]>()
): Map<string, string[]> {
  if (!node) return out;

  const visit = (c: IcCategory) => {
    const name = c.category_name_ka?.trim() || c.category_name_en?.trim() || "";
    // ფესვი "მთავარი"/"main" გზაში არ გვინდა
    const isRoot = String(c.id) === "1" || /^(მთავარი|main)$/i.test(name);
    const path = isRoot || !name ? trail : [...trail, name];
    if (c.id !== undefined && !isRoot) out.set(String(c.id), path);
    if (c.sub_category) {
      const kids = Array.isArray(c.sub_category) ? c.sub_category : Object.values(c.sub_category);
      for (const kid of kids) flattenCategories(kid, path, out);
    }
  };

  if (typeof node === "object" && "id" in node) visit(node as IcCategory);
  else for (const c of Object.values(node as Record<string, IcCategory>)) flattenCategories(c, trail, out);

  return out;
}

function buildUrl(cfg: SupplierConfig, identCode: string, productCode = ""): string {
  const base = (cfg.baseUrl ?? "").replace(/\/+$/, "");
  const parts = [base, cfg.secret ?? "", identCode, productCode].filter((p) => p !== "");
  return parts.join("/");
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const body = (await res.json()) as Record<string, unknown>;
  const status = body.status as { code?: number | string; title?: string } | undefined;
  const code = Number(status?.code ?? 0);
  if (code !== 0) {
    throw new Error(STATUS[code] ?? status?.title ?? `უცნობი სტატუსი: ${code}`);
  }
  return body;
}

export const intellcom: SupplierAdapter = {
  async fetchItems(cfg: SupplierConfig): Promise<SupplierItem[]> {
    if (!cfg.baseUrl) throw new Error("baseUrl მითითებული არ არის");
    if (!cfg.secret) throw new Error("ვებ-სერვისის გასაღები მითითებული არ არის");

    let identCode = "";
    if (cfg.fieldMap) {
      try {
        identCode = String(
          (JSON.parse(cfg.fieldMap) as { identificationCode?: string }).identificationCode ?? ""
        );
      } catch {
        throw new Error('fieldMap არავალიდური JSON-ია — მოსალოდნელია {"identificationCode": "..."}');
      }
    }

    const body = await fetchJson(buildUrl(cfg, identCode));
    const data = (body.data ?? {}) as Record<string, unknown>;
    const products = (data.products ?? []) as IcProduct[];
    if (!Array.isArray(products)) throw new Error("პასუხში data.products სია არ არის");

    // კატეგორიების ხე: ან იმავე პასუხშია, ან ცალკე მისამართზე
    let categoryPaths = new Map<string, string[]>();
    const inline = (data.categories ?? body.categories) as IcCategory | undefined;
    if (inline) {
      categoryPaths = flattenCategories(inline);
    } else {
      try {
        const catUrl = buildUrl({ ...cfg, baseUrl: cfg.baseUrl.replace(/products\/?$/, "categories") }, identCode);
        const catBody = await fetchJson(catUrl);
        const catData = (catBody.data ?? catBody) as Record<string, unknown>;
        categoryPaths = flattenCategories((catData.categories ?? catData) as IcCategory);
      } catch {
        // კატეგორიები არ მოვიდა — პროდუქტები საიმპორტო კალათაში ჩავარდება
      }
    }

    return products.flatMap((p): SupplierItem[] => {
      const sku = String(p.code_id ?? p.id ?? "").trim();
      const name = (p.title?.ka || p.title?.en || "").trim();
      if (!sku || !name) return [];

      const retail = num(p.price) ?? 0;
      const partner = num(p.price_partner) ?? 0;

      const qty = parseQty(p.left_qty);
      const status = p.by_order
        ? "PREORDER"
        : p.in_stock === false || qty <= 0
          ? "OUT_OF_STOCK"
          : "IN_STOCK";

      // პირველივე ამოცნობილი კატეგორია გვაძლევს გზას
      let categoryPath: string[] | undefined;
      for (const c of p.categories ?? []) {
        const path = categoryPaths.get(String(c.category_id));
        if (path?.length) { categoryPath = path; break; }
      }

      const warrantyDays = num(p.warranty_day);

      return [{
        supplierSku: sku,
        name,
        model: p.name?.trim() || null,
        brand: p.brand_name?.trim() || null,
        categoryPath,
        description: p.description_text?.ka?.trim() || p.description?.ka?.trim() || null,
        // ჩვენი თვითღირებულება სადილერო ფასია; მისი არარსებობისას საცალოს ვიღებთ
        cost: partner > 0 ? partner : retail,
        qty,
        status,
        weightKg: num(p.weight),
        volumeM3: num(p.volume),
        warrantyMonths: warrantyDays ? Math.round(warrantyDays / 30.44) : null,
        images: (p.images ?? []).filter((u): u is string => typeof u === "string" && u.length > 0),
        attributes: (p.features?.ka ?? [])
          .filter((f) => f.title && f.value)
          .map((f) => ({ name: f.title!.trim(), value: f.value!.trim() })),
        documents: (p.documents ?? [])
          .map((d) => d.ka ?? d.en)
          .filter((d): d is { name?: string; file?: string } => Boolean(d?.file))
          .map((d) => ({ title: d.name?.trim() || "დოკუმენტაცია", url: d.file! })),
      }];
    });
  },
};
