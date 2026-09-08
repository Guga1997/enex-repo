import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/orders — შეკვეთების წამოღება ბუღალტრულ სისტემაში.
 * პარამეტრები: ?status=PAID&since=2026-08-01&page=1&limit=100
 */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req, "stock:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const since = url.searchParams.get("since");
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 100));

  const where = {
    ...(status ? { status } : {}),
    ...(since ? { createdAt: { gte: new Date(since) } } : {}),
  };

  const [items, total] = await Promise.all([
    db.order.findMany({
      where,
      include: { items: { select: { sku: true, name: true, price: true, qty: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.order.count({ where }),
  ]);

  return NextResponse.json({
    data: items,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
