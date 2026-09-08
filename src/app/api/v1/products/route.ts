import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api-auth";
import { slugify } from "@/lib/format";
import { StockStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** GET /api/v1/products — სრული კატალოგის ექსპორტი გარე სისტემისთვის */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req, "stock:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 100));

  const [items, total] = await Promise.all([
    db.product.findMany({
      include: {
        brand: { select: { name: true, slug: true } },
        category: { select: { nameKa: true, slug: true } },
        images: { select: { url: true }, orderBy: { sortOrder: "asc" } },
        attributes: { select: { name: true, value: true } },
      },
      orderBy: { sku: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.product.count(),
  ]);

  return NextResponse.json({
    data: items,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

const productSchema = z.object({
  sku: z.string().min(1),
  nameKa: z.string().min(1),
  nameEn: z.string().optional(),
  model: z.string().optional(),
  descriptionKa: z.string().optional(),
  price: z.number().min(0),
  oldPrice: z.number().min(0).nullable().optional(),
  qty: z.number().int().min(0).default(0),
  status: z
    .enum([
      StockStatus.IN_STOCK,
      StockStatus.OUT_OF_STOCK,
      StockStatus.IN_TRANSIT,
      StockStatus.PREORDER,
    ])
    .optional(),
  incomingDate: z.string().datetime().nullable().optional(),
  categorySlug: z.string().min(1),
  brandName: z.string().optional(),
  images: z.array(z.string().url()).optional(),
  attributes: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  isActive: z.boolean().optional(),
  isNew: z.boolean().optional(),
});

const upsertSchema = z.object({ items: z.array(productSchema).min(1).max(500) });

/**
 * POST /api/v1/products — პროდუქტების შექმნა/განახლება SKU-ს მიხედვით.
 * გამოიყენე ERP-იდან კატალოგის სრული სინქრონიზაციისთვის.
 */
export async function POST(req: Request) {
  const auth = await authenticateApiKey(req, "stock:write");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "არავალიდური JSON" }, { status: 400 });
  }

  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ვალიდაციის შეცდომა", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const created: string[] = [];
  const updated: string[] = [];
  const failed: { sku: string; reason: string }[] = [];

  for (const item of parsed.data.items) {
    const category = await db.category.findUnique({ where: { slug: item.categorySlug } });
    if (!category) {
      failed.push({ sku: item.sku, reason: `კატეგორია "${item.categorySlug}" არ არსებობს` });
      continue;
    }

    let brandId: string | null = null;
    if (item.brandName) {
      const brand = await db.brand.upsert({
        where: { slug: slugify(item.brandName) },
        create: { slug: slugify(item.brandName), name: item.brandName },
        update: {},
      });
      brandId = brand.id;
    }

    const existing = await db.product.findUnique({ where: { sku: item.sku } });

    const data = {
      nameKa: item.nameKa,
      nameEn: item.nameEn ?? null,
      model: item.model ?? null,
      descriptionKa: item.descriptionKa ?? null,
      price: item.price,
      oldPrice: item.oldPrice ?? null,
      stockQty: item.qty,
      stockStatus: item.status ?? (item.qty > 0 ? StockStatus.IN_STOCK : StockStatus.OUT_OF_STOCK),
      incomingDate: item.incomingDate ? new Date(item.incomingDate) : null,
      categoryId: category.id,
      brandId,
      isActive: item.isActive ?? true,
      isNew: item.isNew ?? false,
    };

    const product = existing
      ? await db.product.update({ where: { sku: item.sku }, data })
      : await db.product.create({
          data: {
            ...data,
            sku: item.sku,
            slug: `${slugify(item.nameKa)}-${item.sku}`,
          },
        });

    // სურათები და მახასიათებლები — გადმოცემისას სრულად ჩანაცვლდება
    if (item.images) {
      await db.productImage.deleteMany({ where: { productId: product.id } });
      await db.productImage.createMany({
        data: item.images.map((url, i) => ({ productId: product.id, url, sortOrder: i })),
      });
    }
    if (item.attributes) {
      await db.productAttribute.deleteMany({ where: { productId: product.id } });
      await db.productAttribute.createMany({
        data: item.attributes.map((a, i) => ({
          productId: product.id,
          name: a.name,
          value: a.value,
          sortOrder: i,
        })),
      });
    }

    (existing ? updated : created).push(item.sku);
  }

  return NextResponse.json({ created: created.length, updated: updated.length, failed });
}
