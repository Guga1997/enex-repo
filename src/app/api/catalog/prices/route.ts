import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { availableQty } from "@/lib/stock";

export const dynamic = "force-dynamic";

/**
 * ფასი და ნაშთი SKU-ების სიით — კონფიგურატორისთვის და მსგავსი სტატიკური ხელსაწყოებისთვის,
 * რომ ფასი ერთ ადგილას (კატალოგში) იცვლებოდეს. მხოლოდ საცალო და მხოლოდ გამოქვეყნებულზე.
 *   GET /api/catalog/prices?sku=AC180P/GE,B300K/GE
 */
export async function GET(req: Request) {
  const skus = (new URL(req.url).searchParams.get("sku") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
  if (!skus.length) return NextResponse.json({});

  // მიმწოდებლის SKU-თი ან ჩვენი SKU-თი — ორივე
  const products = await db.product.findMany({
    where: {
      isActive: true,
      OR: [{ sku: { in: skus } }, { supplies: { some: { supplierSku: { in: skus } } } }],
    },
    select: {
      sku: true, slug: true, price: true, stockQty: true, reservedQty: true, stockStatus: true,
      supplies: { select: { supplierSku: true } },
    },
  });

  const out: Record<string, { price: number; stock: number; status: string; url: string }> = {};
  for (const p of products) {
    const keys = [p.sku, ...p.supplies.map((s) => s.supplierSku)].filter((k) => skus.includes(k));
    for (const k of keys) {
      out[k] = { price: p.price, stock: availableQty(p), status: p.stockStatus, url: `/product/${p.slug}` };
    }
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "public, max-age=60" } });
}
