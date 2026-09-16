import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { PAGE_SIZE } from "./constants";

export type SearchParams = { [k: string]: string | string[] | undefined };

export type CatalogQuery = {
  categoryIds: string[]; // მიმდინარე კატეგორია + ყველა ქვეკატეგორია
  brands: string[];
  statuses: string[];
  priceMin?: number;
  priceMax?: number;
  discount: boolean;
  isNew: boolean;
  q?: string;
  sort: string;
  page: number;
  attrs: Record<string, string[]>;
};

const asArray = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v.flatMap((x) => x.split(",")) : v.split(",");

const num = (v: string | string[] | undefined): number | undefined => {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

/** კატეგორიის ხის ჩამოშლა — ბრუნებს კატეგორიის და მისი ყველა შთამომავლის id-ებს */
export async function categoryIdsWithDescendants(rootId: string): Promise<string[]> {
  const all = await db.category.findMany({ select: { id: true, parentId: true } });
  const byParent = new Map<string, string[]>();
  for (const c of all) {
    if (!c.parentId) continue;
    byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c.id]);
  }
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    stack.push(...(byParent.get(id) ?? []));
  }
  return out;
}

export function parseQuery(sp: SearchParams, categoryIds: string[]): CatalogQuery {
  const attrs: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(sp)) {
    if (!key.startsWith("attr_")) continue;
    const name = decodeURIComponent(key.slice(5));
    const values = asArray(value).filter(Boolean);
    if (values.length) attrs[name] = values;
  }

  return {
    categoryIds,
    brands: asArray(sp.brand).filter(Boolean),
    statuses: asArray(sp.status).filter(Boolean),
    priceMin: num(sp.min),
    priceMax: num(sp.max),
    discount: sp.discount === "1",
    isNew: sp.new === "1",
    q: (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() || undefined,
    sort: (Array.isArray(sp.sort) ? sp.sort[0] : sp.sort) || "default",
    page: Math.max(1, num(sp.page) ?? 1),
    attrs,
  };
}

/**
 * Prisma where-ის აწყობა. `skip` საშუალებას გვაძლევს ერთი ფასეტი გამოვრიცხოთ
 * საკუთარი რაოდენობების დათვლისას (სტანდარტული faceted-search ქცევა).
 */
export function buildWhere(
  q: CatalogQuery,
  skip?: "brand" | "status" | "price"
): Prisma.ProductWhereInput {
  const AND: Prisma.ProductWhereInput[] = [{ isActive: true }];

  if (q.categoryIds.length) AND.push({ categoryId: { in: q.categoryIds } });
  if (skip !== "brand" && q.brands.length) AND.push({ brand: { slug: { in: q.brands } } });
  if (skip !== "status" && q.statuses.length) AND.push({ stockStatus: { in: q.statuses } });

  if (skip !== "price" && (q.priceMin !== undefined || q.priceMax !== undefined)) {
    AND.push({
      price: {
        ...(q.priceMin !== undefined ? { gte: q.priceMin } : {}),
        ...(q.priceMax !== undefined ? { lte: q.priceMax } : {}),
      },
    });
  }

  if (q.discount) AND.push({ oldPrice: { not: null } });
  if (q.isNew) AND.push({ isNew: true });

  if (q.q) {
    AND.push({
      OR: [
        { nameKa: { contains: q.q } },
        { nameEn: { contains: q.q } },
        { model: { contains: q.q } },
        { sku: { contains: q.q } },
      ],
    });
  }

  for (const [name, values] of Object.entries(q.attrs)) {
    AND.push({ attributes: { some: { name, value: { in: values } } } });
  }

  return { AND };
}

function orderBy(sort: string): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ price: "asc" }];
    case "price_desc":
      return [{ price: "desc" }];
    case "name_asc":
      return [{ nameKa: "asc" }];
    case "newest":
      return [{ createdAt: "desc" }];
    default:
      return [{ sortOrder: "asc" }, { price: "asc" }];
  }
}

export type Facets = Awaited<ReturnType<typeof getFacets>>;

/** ფასეტები რაოდენობებით — ბრენდი, სტატუსი, ფასის დიაპაზონი, მახასიათებლები */
export async function getFacets(q: CatalogQuery) {
  const [brandGroups, statusGroups, priceAgg, attrRows] = await Promise.all([
    db.product.groupBy({
      by: ["brandId"],
      where: buildWhere(q, "brand"),
      _count: { _all: true },
    }),
    db.product.groupBy({
      by: ["stockStatus"],
      where: buildWhere(q, "status"),
      _count: { _all: true },
    }),
    db.product.aggregate({
      where: buildWhere(q, "price"),
      _min: { price: true },
      _max: { price: true },
    }),
    db.productAttribute.findMany({
      where: { filterable: true, product: buildWhere(q) },
      select: { name: true, value: true },
    }),
  ]);

  const brandIds = brandGroups.map((g) => g.brandId).filter(Boolean) as string[];
  const brandRecords = await db.brand.findMany({ where: { id: { in: brandIds } } });
  const brandById = new Map(brandRecords.map((b) => [b.id, b]));

  const brands = brandGroups
    .filter((g) => g.brandId && brandById.has(g.brandId))
    .map((g) => ({
      slug: brandById.get(g.brandId!)!.slug,
      name: brandById.get(g.brandId!)!.name,
      count: g._count._all,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const statuses = statusGroups
    .map((g) => ({ key: g.stockStatus, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  // მახასიათებლების ფასეტი: name -> [{value, count}]
  const attrMap = new Map<string, Map<string, number>>();
  for (const row of attrRows) {
    if (!attrMap.has(row.name)) attrMap.set(row.name, new Map());
    const vals = attrMap.get(row.name)!;
    vals.set(row.value, (vals.get(row.value) ?? 0) + 1);
  }
  const attributes = [...attrMap.entries()]
    .map(([name, vals]) => ({
      name,
      values: [...vals.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
    }))
    .filter((a) => a.values.length > 1)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 8);

  const [discountCount, newCount] = await Promise.all([
    db.product.count({ where: { AND: [buildWhere(q), { oldPrice: { not: null } }] } }),
    db.product.count({ where: { AND: [buildWhere(q), { isNew: true }] } }),
  ]);

  return {
    brands,
    statuses,
    attributes,
    priceMin: Math.floor(priceAgg._min.price ?? 0),
    priceMax: Math.ceil(priceAgg._max.price ?? 0),
    discountCount,
    newCount,
  };
}

export const productCardSelect = {
  id: true,
  sku: true,
  slug: true,
  nameKa: true,
  model: true,
  price: true,
  dealerPrice: true,
  oldPrice: true,
  stockQty: true,
  reservedQty: true,
  stockStatus: true,
  incomingDate: true,
  lowStockAt: true,
  isNew: true,
  images: { select: { url: true, alt: true }, orderBy: { sortOrder: "asc" }, take: 1 },
  brand: { select: { name: true, slug: true } },
} satisfies Prisma.ProductSelect;

export async function getProducts(q: CatalogQuery) {
  const where = buildWhere(q);
  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      select: productCardSelect,
      orderBy: orderBy(q.sort),
      skip: (q.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.product.count({ where }),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
