import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api-auth";
import { deriveStatus } from "@/lib/stock";
import { StockStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ sku: string }> };

/** GET /api/v1/stock/:sku — ერთი პროდუქტის ნაშთი */
export async function GET(req: Request, { params }: Ctx) {
  const auth = await authenticateApiKey(req, "stock:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { sku } = await params;
  const product = await db.product.findUnique({
    where: { sku },
    select: {
      sku: true,
      nameKa: true,
      price: true,
      oldPrice: true,
      stockQty: true,
      stockStatus: true,
      incomingDate: true,
      isActive: true,
      updatedAt: true,
    },
  });

  if (!product) return NextResponse.json({ error: "პროდუქტი ვერ მოიძებნა" }, { status: 404 });
  return NextResponse.json({ data: product });
}

const patchSchema = z.object({
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
  isActive: z.boolean().optional(),
});

/** PUT /api/v1/stock/:sku — ერთი პროდუქტის ნაშთის/ფასის განახლება */
export async function PUT(req: Request, { params }: Ctx) {
  const auth = await authenticateApiKey(req, "stock:write");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { sku } = await params;
  const current = await db.product.findUnique({ where: { sku } });
  if (!current) return NextResponse.json({ error: "პროდუქტი ვერ მოიძებნა" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "არავალიდური JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ვალიდაციის შეცდომა", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const newQty = input.qty ?? current.stockQty;
  const newStatus = input.status ?? deriveStatus(newQty, current.stockStatus);

  const updated = await db.product.update({
    where: { sku },
    data: {
      stockQty: newQty,
      stockStatus: newStatus,
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.oldPrice !== undefined ? { oldPrice: input.oldPrice } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.incomingDate !== undefined
        ? { incomingDate: input.incomingDate ? new Date(input.incomingDate) : null }
        : {}),
    },
    select: {
      sku: true,
      price: true,
      oldPrice: true,
      stockQty: true,
      stockStatus: true,
      incomingDate: true,
      isActive: true,
    },
  });

  if (newQty !== current.stockQty || newStatus !== current.stockStatus) {
    await db.stockSyncLog.create({
      data: {
        source: auth.keyName,
        sku,
        oldQty: current.stockQty,
        newQty,
        oldStatus: current.stockStatus,
        newStatus,
      },
    });
  }

  return NextResponse.json({ data: updated });
}
