/**
 * დაბრუნების პოლიტიკის მე-5 და 4.6 პუნქტები პროდუქტის გვერდზე — პოლიტიკა ამბობს, რომ
 * გამონაკლისს და დიდი გაბარიტის გატანას შეკვეთამდე პროდუქტის გვერდზე ვუთითებთ.
 */
const HOTEL_ROOT = "სასტუმროს სისტემები";
const GENERATORS_ROOT = "დიზელის გენერატორები";

export type ReturnNote = { restricted?: string; bulky?: boolean };

export function returnNote(p: {
  nameKa: string;
  model?: string | null;
  unit?: string | null;
  qtyStep?: number;
  weightKg?: number | null;
  categoryNames: string[];
}): ReturnNote {
  const out: ReturnNote = {};
  const text = `${p.nameKa} ${p.model ?? ""}`;
  // მეტრობით, სასურველ სიგრძეზე იჭრება (მთლიანი შეკვრა — არა)
  if (p.unit && (p.qtyStep ?? 1) <= 1) out.restricted = "იჭრება შეკვეთილ სიგრძეზე";
  else if (/ლიცენზ|licen[cs]e/i.test(text)) out.restricted = "ლიცენზიაა — ლუქის ან აქტივაციის შემდეგ აღარ ბრუნდება";
  else if (p.categoryNames.includes(HOTEL_ROOT) && /ბარათ|საკეტ|card|lock/i.test(text))
    out.restricted = "სასტუმროსთვის შეკვეთით პროგრამდება";
  if (p.categoryNames.includes(GENERATORS_ROOT) || (p.weightKg ?? 0) >= 30) out.bulky = true;
  return out;
}
