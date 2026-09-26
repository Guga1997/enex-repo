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

  if (p.stockStatus === StockStatus.IN_STOCK && qty > 0) {
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
    (p.stockStatus === StockStatus.IN_STOCK && availableQty(p) > 0) ||
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
