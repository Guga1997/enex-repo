import { StockStatus } from "./constants";
import type { T } from "./i18n/dict";
import { formatDate } from "./format";

type StockLike = {
  stockQty: number;
  /** გაუფორმებელ შეკვეთებში დაკავებული — მყიდველისთვის ეს უკვე არ არსებობს */
  reservedQty?: number;
  stockStatus: string;
  incomingDate?: Date | string | null;
  lowStockAt?: number;
  /** შეკვეთის მინიმუმი — ამაზე ნაკლები ნაშთი ვეღარ იყიდება */
  minQty?: number;
};

/** რაც მართლა იყიდება: ნაშთს გამოკლებული სხვისი რეზერვაცია */
export function availableQty(p: { stockQty: number; reservedQty?: number }): number {
  return Math.max(0, p.stockQty - (p.reservedQty ?? 0));
}

/** intellcom-ის სტილის ნაშთის წარწერა — "მარაგშია" / "დარჩენილია 5 ცალი" / ... */
export function stockLabel(
  p: StockLike,
  t: T = (s) => s
): { text: string; tone: "ok" | "low" | "transit" | "none" } {
  const low = p.lowStockAt ?? 5;
  const qty = availableQty(p);

  if (p.stockStatus === StockStatus.IN_STOCK && qty >= Math.max(1, p.minQty ?? 1)) {
    if (qty <= 2) return { text: t("დარჩენილია ბოლო ერთეულები"), tone: "low" };
    if (qty <= low) return { text: t("დარჩენილია {0} ცალი", qty), tone: "low" };
    return { text: t("მარაგშია"), tone: "ok" };
  }
  if (p.stockStatus === StockStatus.IN_TRANSIT) {
    const eta = p.incomingDate ? t(", სავარაუდო ჩამოსვლა: {0}", formatDate(p.incomingDate)) : "";
    return { text: t("გზაშია") + eta, tone: "transit" };
  }
  if (p.stockStatus === StockStatus.PREORDER) {
    return { text: t("მხოლოდ წინასწარი შეკვეთით"), tone: "transit" };
  }
  return { text: t("დროებით არ გვაქვს საწყობში"), tone: "none" };
}

/** შეიძლება თუ არა კალათაში დამატება */
export function isPurchasable(p: StockLike): boolean {
  return (
    (p.stockStatus === StockStatus.IN_STOCK && availableQty(p) >= Math.max(1, p.minQty ?? 1)) ||
    p.stockStatus === StockStatus.IN_TRANSIT ||
    p.stockStatus === StockStatus.PREORDER
  );
}

/** ქვანტიტეტიდან სტატუსის ავტომატური გამოთვლა სტოკის სინქრონიზაციისას */
export function deriveStatus(qty: number, current: string): string {
  if (qty > 0) return StockStatus.IN_STOCK;
  // 0 ცალი — თუ უკვე გზაშია/წინასწარი შეკვეთაა, სტატუსს არ ვცვლით
  if (current === StockStatus.IN_TRANSIT || current === StockStatus.PREORDER) return current;
  return StockStatus.OUT_OF_STOCK;
}

/* -------------------------------- ჩემი მარაგი -------------------------------- */

/** სულ = მიმწოდებლების ჯამი + ჩემი ჩაწერილი მარაგი (Product.stockAdjust) */
export function rolledUpQty(supplyQtys: number[], ownQty: number): number {
  return Math.max(0, supplyQtys.reduce((sum, q) => sum + q, 0) + ownQty);
}

/** გაყიდვა: ჯერ ჩემი მარაგი აკლდება, სანამ არ განულდება, დარჩენილი — მიმწოდებლებს */
export function splitSale(ownQty: number, supplyQtys: number[], soldQty: number) {
  const fromOwn = Math.min(Math.max(0, ownQty), soldQty);
  let rest = soldQty - fromOwn;
  const supplies = supplyQtys.map((q) => {
    const take = Math.min(Math.max(0, q), rest);
    rest -= take;
    return q - take;
  });
  return { own: ownQty - fromOwn, supplies };
}

/* ------------------------------ შეკვეთის წესი ------------------------------- */

/**
 * რაოდენობა წესში ჩასმული: მინიმუმი + ბიჯის ჯერადი (ზემოთ ამრგვალებს), მაქსიმუმამდე.
 * 0 — ნაშთი მინიმუმსაც არ ყოფნის. maxQty 0 = ლიმიტის გარეშე.
 */
export function normalizeQty(qty: number, rule: { minQty?: number; qtyStep?: number }, maxQty = 0): number {
  const min = Math.max(1, rule.minQty ?? 1);
  const step = Math.max(1, rule.qtyStep ?? 1);
  const up = qty <= min ? min : min + Math.ceil((qty - min) / step) * step;
  if (maxQty <= 0 || up <= maxQty) return up;
  return maxQty < min ? 0 : min + Math.floor((maxQty - min) / step) * step;
}
