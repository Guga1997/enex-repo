/**
 * ფასის დონეები: საცალო და პარტნიორების საფეხურები.
 *
 * პარტნიორის ფასდაკლება საცალო ფასზე კი არ ითვლება, არამედ **მოგებაზე** —
 * იმ სხვაობაზე, რაც საცალო ფასსა და თვითღირებულებას შორისაა. ასე ფასდაკლება
 * თვითონ ერგება პროდუქტს: სადაც მოგება დიდია, პარტნიორიც მეტს იგებს, სადაც
 * მცირეა — ზარალში არ ვრჩებით.
 *
 *   მოგება  = საცალო − თვითღირებულება
 *   ფასი    = საცალო − წილი × მოგება
 *
 * ყოველი შემდეგი საფეხური 10 პუნქტით მეტია, მაგრამ **მოგების 60% ყოველთვის
 * ჩვენთან რჩება** — ანუ პარტნიორს მაქსიმუმ 40% ერგება. ეს ზღვარი ცალკე
 * შემოწმებაა და არა მარტო ცხრილის ბოლო სტრიქონი: ინდივიდუალური ფასდაკლებაც
 * მას ემორჩილება.
 */

export const MAX_PARTNER_SHARE = 0.4; // მოგების 60% ყოველთვის ჩვენსკენ

export const TIERS = [
  { code: "RETAIL", label: "საცალო", share: 0 },
  { code: "DEALER", label: "დილერი", share: 0.1 },
  { code: "SILVER", label: "ვერცხლი", share: 0.2 },
  { code: "GOLD", label: "ოქრო", share: 0.3 },
  { code: "PLATINUM", label: "პლატინა", share: 0.4 },
] as const;

export type TierCode = (typeof TIERS)[number]["code"];

export const TIER_LABEL: Record<string, string> = Object.fromEntries(
  TIERS.map((t) => [t.code, t.label])
);

/** უცნობი კოდი საცალოდ ითვლება — ახალი დონე შემთხვევით ფასდაკლებას არ გასცემს */
export function tierShare(code: string): number {
  const t = TIERS.find((x) => x.code === code);
  return t ? Math.min(t.share, MAX_PARTNER_SHARE) : 0;
}

export const isPartner = (code: string) => tierShare(code) > 0;

/**
 * share — ფანჯრიდან დაყენებული წილი. getCurrentUser() ერთხელ ავსებს, რომ ფასი
 * სინქრონულად ითვლებოდეს; თუ არ არის, კოდის ნაგულისხმევი მოქმედებს.
 */
export type Viewer = { priceTier: string; discountPercent: number; share?: number } | null;

export type PricedProduct = {
  price: number;
  dealerPrice?: number | null;
  oldPrice?: number | null;
  /** თვითღირებულება — მხოლოდ სერვერზე; კლიენტამდე არასდროს მიდის */
  cost?: number | null;
  /** მიმწოდებლის საცალო — თუ არსებობს, საფეხურები მისგან ითვლება */
  listPrice?: number | null;
};

export type EffectivePrice = {
  /** რასაც მომხმარებელი იხდის */
  value: number;
  /** საცალო ფასი — ჩვენდება გადახაზულად, როცა value მასზე ნაკლებია */
  retail: number;
  /** ფასდაკლების ოდენობა ₾-ში (0, თუ ფასდაკლება არ არის) */
  saved: number;
  savedPercent: number;
  isDealer: boolean;
  /** რომელი საფეხურით დაითვალა */
  tier: string;
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * მოგების წილით დათვლილი ფასი. თვითღირებულების გარეშე ვერ ითვლება —
 * ასეთ შემთხვევაში null ბრუნდება და ძველი წესები მოქმედებს.
 */
/**
 * საფეხურების ბაზა. მიმწოდებელი თუ საცალოსაც გვაძლევს, ყველა საფეხური — ჩვენი
 * საცალოს ჩათვლით — **მისი** საცალოდან და **მისი** მოგებიდან ითვლება:
 *
 *   M = მისი საცალო − ქოსთი
 *   საცალო 5%, დილერი 10%, ვერცხლი 20%, ოქრო 30%, პლატინა 40% — ყველა M-იდან
 *
 * ასე საფეხურები ერთმანეთზე არ ეწყობა: დილერი ზუსტად M-ის 10%-ს იღებს და არა
 * ჩვენი საცალოს მოგების 10%-ს. სხვა შემთხვევაში ბაზა ჩვენი საცალოა.
 */
function baseOf(p: PricedProduct): number {
  const list = p.listPrice != null && p.listPrice > 0 ? p.listPrice : null;
  return list !== null && p.cost != null && list > p.cost ? list : p.price;
}

function marginPrice(base: number, cost: number | null | undefined, share: number): number | null {
  if (cost == null || !(cost > 0) || share <= 0) return null;
  const margin = Math.max(0, base - cost); // ზარალიან პროდუქტზე ფასდაკლება არ ედება
  return base - share * margin;
}

export function effectivePrice(p: PricedProduct, viewer: Viewer): EffectivePrice {
  const retail = p.price;
  const tier = viewer ? viewer.priceTier : "RETAIL";
  const share =
    viewer && typeof viewer.share === "number"
      ? Math.min(Math.max(viewer.share, 0), MAX_PARTNER_SHARE)
      : tierShare(tier);
  const partner = share > 0;

  let value = retail;
  const base = baseOf(p);

  const byMargin = marginPrice(base, p.cost, share);
  if (byMargin !== null) {
    value = byMargin;
  } else if (partner && p.dealerPrice != null && p.dealerPrice > 0) {
    // თვითღირებულება უცნობია — ხელით დაწერილი სადილერო ფასი რჩება ძალაში
    value = p.dealerPrice;
  }

  // ინდივიდუალური ფასდაკლება — ცალკე ბერკეტი; რომელიც მომხმარებელს ურჩევნია
  if (viewer && viewer.discountPercent > 0) {
    value = Math.min(value, retail * (1 - viewer.discountPercent / 100));
  }

  // მოგების 60% ყოველთვის ჩვენსკენ — ინდივიდუალური პროცენტიც ამას ემორჩილება
  const floor = marginPrice(base, p.cost, MAX_PARTNER_SHARE);
  if (floor !== null) value = Math.max(value, floor);

  // პარტნიორი საცალოზე ძვირს არასდროს იხდის — მაგალითად, თუ ჩვენი საცალო
  // ხელით დაბლა ჩამოიწია და საფეხურის ფორმულამ მასზე მაღალი გამოიყვანა
  value = Math.min(value, retail);

  value = Math.max(0, round(value));
  const saved = Math.max(0, round(retail - value));

  return {
    value,
    retail,
    saved,
    savedPercent: retail > 0 ? Math.round((saved / retail) * 1000) / 10 : 0,
    isDealer: partner,
    tier,
  };
}

/** კალათის/შეკვეთის ჯამი ყოველთვის სერვერზე — კლიენტიდან მოსული ფასი იგნორირდება */
export function lineTotal(p: PricedProduct, qty: number, viewer: Viewer): number {
  return round(effectivePrice(p, viewer).value * qty);
}

/** რა რჩება ჩვენთან ამ გაყიდვაზე — ადმინის ანგარიშებისთვის */
export function ourMargin(p: PricedProduct, viewer: Viewer): number | null {
  if (p.cost == null || !(p.cost > 0)) return null;
  return round(effectivePrice(p, viewer).value - p.cost);
}
