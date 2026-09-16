export const StockStatus = {
  IN_STOCK: "IN_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  IN_TRANSIT: "IN_TRANSIT",
  PREORDER: "PREORDER",
} as const;
export type StockStatusKey = keyof typeof StockStatus;

export const STOCK_LABELS: Record<string, string> = {
  IN_STOCK: "მარაგშია",
  OUT_OF_STOCK: "დროებით არ გვაქვს საწყობში",
  IN_TRANSIT: "გზაშია",
  PREORDER: "მხოლოდ წინასწარი შეკვეთით",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "მოლოდინში",
  PAID: "გადახდილი",
  PROCESSING: "მუშავდება",
  SHIPPED: "გაგზავნილი",
  DELIVERED: "მიწოდებული",
  CANCELLED: "გაუქმებული",
  EXPIRED: "ვადა გაუვიდა",
  RETURNED: "დაბრუნებული",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "გადაუხდელი",
  PAID: "გადახდილი",
  FAILED: "წარუმატებელი",
  REFUNDED: "დაბრუნებული",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BOG: "ბარათით (საქართველოს ბანკი)",
  TBC: "ბარათით (თიბისი)",
  BANK_TRANSFER: "საბანკო გადარიცხვა",
  INSTALLMENT: "განვადება",
  POS: "ბარათით ადგილზე (POS ტერმინალი)",
};

export const SORT_OPTIONS = [
  { value: "default", label: "სტანდარტული დალაგება" },
  { value: "price_asc", label: "ფასი — ზრდადობით" },
  { value: "price_desc", label: "ფასი — კლებადობით" },
  { value: "name_asc", label: "დალაგება ანბანით" },
  { value: "newest", label: "ჯერ ახალი" },
] as const;

/** კაბინეტის სამი განყოფილება — რომელი სტატუსი სად ჯდება */
export const ORDER_BUCKETS = {
  current: { label: "მიმდინარე შეკვეთები", statuses: ["PENDING", "PAID", "PROCESSING", "SHIPPED"] },
  done: { label: "დასრულებული შეკვეთები", statuses: ["DELIVERED"] },
  returned: { label: "უკან დაბრუნებული", statuses: ["RETURNED", "CANCELLED", "EXPIRED"] },
} as const;
export type OrderBucket = keyof typeof ORDER_BUCKETS;

export const DELIVERY_METHOD_LABELS: Record<string, string> = {
  COURIER: "ადგილზე მიტანა",
  PICKUP: "საწყობიდან გატანა",
};

/**
 * რამდენ წუთს რჩება ნაშთი დაკავებული გაუფორმებელ შეკვეთაზე.
 * ონლაინ გადახდა წუთებში სრულდება; გადარიცხვას ბანკის ერთი-ორი დღე სჭირდება.
 */
export const RESERVATION_MINUTES: Record<string, number> = {
  BOG: 15,
  TBC: 15,
  BANK_TRANSFER: 48 * 60,
  POS: 48 * 60,
  INSTALLMENT: 48 * 60,
  DEFAULT: 15,
};

export const PAGE_SIZE = 24;
export const DELIVERY_FEE_TBILISI = 0;
export const FREE_DELIVERY_FROM = 200;
