import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api-auth";
import { deriveStatus } from "@/lib/stock";
import { StockStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/stock — ყველა პროდუქტის მიმდინარე ნაშთი
 * პარამეტრები: ?page=1&limit=200&updated_since=2026-08-01
 */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req, "stock:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit")) || 200));
  const since = url.searchParams.get("updated_since");

  const where = since ? { updatedAt: { gte: new Date(since) } } : {};

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      select: {
        sku: true,
        nameKa: true,
        model: true,
        price: true,
        oldPrice: true,
        stockQty: true,
        stockStatus: true,
        incomingDate: true,
        isActive: true,
        updatedAt: true,
      },
      orderBy: { sku: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.product.count({ where }),
  ]);

  return NextResponse.json({
    data: items,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

const bulkSchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        qty: z.number().int().min(0).optional(),
        price: z.number().min(0).optional(),
        oldPrice: z.number().min(0).nullable().optional(),
        status: z
          .enum([
            StockStatus.IN_STOCK,
            StockStatus.OUT_OF_STOCK,
            StockStatus.IN_TRANSIT,
            StockStatus.PREORDER,
          ])
          .optional(),
        incomingDate: z.string().datetime().nullable().optional(),
      })
    )
    .min(1)
    .max(2000),
});

/**
 * POST /api/v1/stock — მასობრივი განახლება SKU-ს მიხედვით.
 *
 * body: { "items": [ { "sku": "03904", "qty": 12, "price": 729.00 } ] }
 *
 * qty-ის გადმოცემისას სტატუსი ავტომატურად გამოითვლება, თუ status ცალკე
 * არ არის მითითებული. უცნობი SKU-ები ბრუნდება `notFound` მასივში.
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

  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ვალიდაციის შეცდომა", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const skus = parsed.data.items.map((i) => i.sku);
  const existing = await db.product.findMany({
    where: { sku: { in: skus } },
    select: { id: true, sku: true, stockQty: true, stockStatus: true },
  });
  const bySku = new Map(existing.map((p) => [p.sku, p]));

  const updated: string[] = [];
  const notFound: string[] = [];
  const logs: {
    source: string;
    sku: string;
    oldQty: number;
    newQty: number;
    oldStatus: string;
    newStatus: string;
  }[] = [];

  for (const item of parsed.data.items) {
    const current = bySku.get(item.sku);
    if (!current) {
      notFound.push(item.sku);
      continue;
    }

    const newQty = item.qty ?? current.stockQty;
    const newStatus = item.status ?? deriveStatus(newQty, current.stockStatus);

    await db.product.update({
      where: { id: current.id },
      data: {
        stockQty: newQty,
        stockStatus: newStatus,
        ...(item.price !== undefined ? { price: item.price } : {}),
        ...(item.oldPrice !== undefined ? { oldPrice: item.oldPrice } : {}),
        ...(item.incomingDate !== undefined
          ? { incomingDate: item.incomingDate ? new Date(item.incomingDate) : null }
          : {}),
      },
    });

    updated.push(item.sku);
    if (newQty !== current.stockQty || newStatus !== current.stockStatus) {
      logs.push({
        source: auth.keyName,
        sku: item.sku,
        oldQty: current.stockQty,
        newQty,
        oldStatus: current.stockStatus,
        newStatus,
      });
    }
  }

  if (logs.length) await db.stockSyncLog.createMany({ data: logs });

  return NextResponse.json({
    updated: updated.length,
    notFound,
    skus: updated,
  });
}
