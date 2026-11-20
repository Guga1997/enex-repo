import type { Prisma } from "@prisma/client";
import { ci } from "./search-mode";

/** ერთი ფილტრი სიისთვისაც და მასობრივი ქმედებისთვისაც — რომ არ დაშორდნენ */
export function productFilter(f: {
  q?: string; category?: string; supplier?: string; status?: string; stock?: string;
  /** საწყობი: "api" — მიმწოდებლებიდან მოსული ნაშთი, "own" — ჩემი საწყობი */
  warehouse?: string;
}): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  const AND: Prisma.ProductWhereInput[] = [];

  if (f.q) AND.push({ OR: [
    { nameKa: ci(f.q) }, { nameEn: ci(f.q) }, { nameRu: ci(f.q) }, { sku: ci(f.q) }, { model: ci(f.q) },
  ] });
  if (f.category) AND.push({ categoryId: f.category });

  // supplier: id → იმ კომპანიიდან; "manual" → არცერთი მიმწოდებელი (ხელით შექმნილი)
  if (f.supplier === "manual") AND.push({ supplies: { none: {} } });
  else if (f.supplier) AND.push({ supplies: { some: { supplierId: f.supplier } } });

  // ჩემი საწყობი: მიმწოდებლის პროდუქტზე ცალკე ველია (stockAdjust), ხელით შექმნილზე — მთელი ნაშთი
  const OWN: Prisma.ProductWhereInput = { OR: [{ stockAdjust: { gt: 0 } }, { supplies: { none: {} }, stockQty: { gt: 0 } }] };
  if (f.warehouse === "own") AND.push(OWN);
  else if (f.warehouse === "api")
    AND.push({ supplies: { some: { qty: { gt: 0 }, ...(f.supplier && f.supplier !== "manual" ? { supplierId: f.supplier } : {}) } } });

  if (f.status === "active") AND.push({ isActive: true });
  else if (f.status === "hidden") AND.push({ isActive: false });

  if (f.stock === "alert") AND.push({ OR: [
    { stockStatus: "OUT_OF_STOCK" },
    { stockStatus: "IN_STOCK", stockQty: { gt: 0, lte: 5 } },
  ] });
  else if (f.stock === "in") AND.push({ stockQty: { gt: 0 } });
  else if (f.stock === "low") AND.push({ stockQty: { gt: 0, lte: 5 } });
  else if (f.stock === "out") AND.push({ stockQty: { lte: 0 } });
  else if (f.stock === "reserved") AND.push({ reservedQty: { gt: 0 } });
  else if (f.stock === "own") AND.push(OWN); // ძველი ბმულები

  if (AND.length) where.AND = AND;
  return where;
}
