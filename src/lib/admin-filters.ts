import type { Prisma } from "@prisma/client";

/** ერთი ფილტრი სიისთვისაც და მასობრივი ქმედებისთვისაც — რომ არ დაშორდნენ */
export function productFilter(f: {
  q?: string; category?: string; supplier?: string; status?: string; stock?: string;
}): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  const AND: Prisma.ProductWhereInput[] = [];

  if (f.q) AND.push({ OR: [
    { nameKa: { contains: f.q } }, { sku: { contains: f.q } }, { model: { contains: f.q } },
  ] });
  if (f.category) AND.push({ categoryId: f.category });

  // supplier: id → იმ კომპანიიდან; "manual" → არცერთი მიმწოდებელი (ხელით შექმნილი)
  if (f.supplier === "manual") AND.push({ supplies: { none: {} } });
  else if (f.supplier) AND.push({ supplies: { some: { supplierId: f.supplier } } });

  if (f.status === "active") AND.push({ isActive: true });
  else if (f.status === "hidden") AND.push({ isActive: false });

  if (f.stock === "alert") AND.push({ OR: [
    { stockStatus: "OUT_OF_STOCK" },
    { stockStatus: "IN_STOCK", stockQty: { gt: 0, lte: 5 } },
  ] });

  if (AND.length) where.AND = AND;
  return where;
}
