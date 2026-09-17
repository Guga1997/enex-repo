/**
 * ყველა მიმწოდებელი ერთ ფორმამდე მოჰყავს ადაპტერს.
 * ახალი კომპანია ან fieldMap-ით ეწერება (კოდის გარეშე), ან თავისი ფაილით —
 * src/lib/suppliers/<slug>.ts, რომელიც SupplierAdapter-ს აბრუნებს.
 */
export type SupplierItem = {
  supplierSku: string;
  name: string;
  model?: string | null;
  brand?: string | null;
  /// კატეგორიის გზა მიმწოდებელთან: ["ენერგო უზრუნველყოფა", "UPS"]
  categoryPath?: string[];
  description?: string | null;

  cost?: number | null;
  qty: number;
  status?: string | null;
  incomingDate?: Date | null;
  leadTimeDays?: number | null;

  images?: string[];
  attributes?: { name: string; value: string }[];
  documents?: { title: string; url: string }[];

  weightKg?: number | null;
  volumeM3?: number | null;
  warrantyMonths?: number | null;
};

export type SupplierConfig = {
  slug: string;
  name: string;
  baseUrl: string | null;
  authType: string;
  secret: string | null;
  authHeader: string | null;
  fieldMap: string | null;
};

export type SupplierAdapter = {
  /** სრული კატალოგი ან მხოლოდ ნაშთი — რასაც კომპანია იძლევა */
  fetchItems(cfg: SupplierConfig): Promise<SupplierItem[]>;
};

/**
 * მოთხოვნის მისამართი — QUERY ავტორიზაციაზე გასაღები აქ ემატება (?api_key=…),
 * რომ baseUrl-ში ღიად არ ეწეროს და ადმინში არ ჩანდეს.
 */
export function requestUrl(cfg: SupplierConfig, base = cfg.baseUrl ?? ""): string {
  if (cfg.authType !== "QUERY" || !cfg.secret) return base;
  const u = new URL(base);
  u.searchParams.set(cfg.authHeader || "api_key", cfg.secret);
  return u.toString();
}

export function authHeaders(cfg: SupplierConfig): Record<string, string> {
  if (!cfg.secret) return {};
  switch (cfg.authType) {
    case "BEARER":
      return { Authorization: `Bearer ${cfg.secret}` };
    case "HEADER_KEY":
      return { [cfg.authHeader || "X-API-Key"]: cfg.secret };
    case "BASIC":
      return { Authorization: `Basic ${Buffer.from(cfg.secret).toString("base64")}` };
    default:
      return {};
  }
}
