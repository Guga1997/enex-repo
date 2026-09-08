/**
 * ფასის ორი დონე: საცალო (სტუმარი) და სადილერო (დარეგისტრირებული დილერი).
 * სადილერო ფასი პროდუქტზე პირდაპირ ეწერება; თუ არ აწერია, ინდივიდუალური
 * პროცენტი მოქმედებს. ორივეს არარსებობისას ფასი საცალოს უდრის.
 */
export type Viewer = { priceTier: string; discountPercent: number } | null;

export type PricedProduct = {
  price: number;
  dealerPrice?: number | null;
  oldPrice?: number | null;
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
};

export function effectivePrice(p: PricedProduct, viewer: Viewer): EffectivePrice {
  const retail = p.price;
  let value = retail;
  const isDealer = viewer?.priceTier === "DEALER";

  if (isDealer) {
    if (p.dealerPrice != null && p.dealerPrice > 0) value = p.dealerPrice;
    else if (viewer!.discountPercent > 0) value = retail * (1 - viewer!.discountPercent / 100);
  } else if (viewer && viewer.discountPercent > 0) {
    value = retail * (1 - viewer.discountPercent / 100);
  }

  value = Math.round(value * 100) / 100;
  const saved = Math.max(0, Math.round((retail - value) * 100) / 100);

  return {
    value,
    retail,
    saved,
    savedPercent: retail > 0 ? Math.round((saved / retail) * 1000) / 10 : 0,
    isDealer,
  };
}

/** კალათის/შეკვეთის ჯამი ყოველთვის სერვერზე — კლიენტიდან მოსული ფასი იგნორირდება */
export function lineTotal(p: PricedProduct, qty: number, viewer: Viewer): number {
  return Math.round(effectivePrice(p, viewer).value * qty * 100) / 100;
}
