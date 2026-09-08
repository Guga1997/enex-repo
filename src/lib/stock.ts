import { StockStatus } from "./constants";
import { formatDate } from "./format";

type StockLike = {
  stockQty: number;
  stockStatus: string;
  incomingDate?: Date | string | null;
  lowStockAt?: number;
};

/** intellcom-ის სტილის ნაშთის წარწერა — "მარაგშია" / "დარჩენილია 5 ცალი" / ... */
export function stockLabel(p: StockLike): { text: string; tone: "ok" | "low" | "transit" | "none" } {
  const low = p.lowStockAt ?? 5;

  if (p.stockStatus === StockStatus.IN_STOCK && p.stockQty > 0) {
    if (p.stockQty <= 2) return { text: "დარჩენილია ბოლო ერთეულები", tone: "low" };
    if (p.stockQty <= low) return { text: `დარჩენილია ${p.stockQty} ცალი`, tone: "low" };
    return { text: "მარაგშია", tone: "ok" };
  }
  if (p.stockStatus === StockStatus.IN_TRANSIT) {
    const eta = p.incomingDate ? `, სავარაუდო ჩამოსვლა: ${formatDate(p.incomingDate)}` : "";
    return { text: `გზაშია${eta}`, tone: "transit" };
  }
  if (p.stockStatus === StockStatus.PREORDER) {
    return { text: "მხოლოდ წინასწარი შეკვეთით", tone: "transit" };
  }
  return { text: "დროებით არ გვაქვს საწყობში", tone: "none" };
}

/** შეიძლება თუ არა კალათაში დამატება */
export function isPurchasable(p: StockLike): boolean {
  return (
    (p.stockStatus === StockStatus.IN_STOCK && p.stockQty > 0) ||
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
