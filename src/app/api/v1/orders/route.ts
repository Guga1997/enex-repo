import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/orders — შეკვეთების წამოღება ბუღალტრულ სისტემაში.
 * პარამეტრები: ?status=PAID&since=2026-08-01&page=1&limit=100
 */
export async function GET(req: Request) {
  // შეკვეთებში მყიდველის პირადი მონაცემებია — ცალკე უფლება, კატეგორიით შეზღუდულ გასაღებს არა
  const auth = await authenticateApiKey(req, "orders:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.categorySlug) {
    return NextResponse.json({ error: "კატეგორიით შეზღუდულ გასაღებს შეკვეთები არ ეკუთვნის" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const since = url.searchParams.get("since");
  const page = Math.min(100_000, Math.max(1, Math.floor(Number(url.searchParams.get("page")) || 1)));
  const limit = Math.min(500, Math.max(1, Math.floor(Number(url.searchParams.get("limit")) || 100)));

  const sinceDate = since ? new Date(since) : null;
  if (sinceDate && Number.isNaN(sinceDate.getTime())) {
    return NextResponse.json({ error: "since — არასწორი თარიღი" }, { status: 400 });
  }
  const where = {
    ...(status ? { status } : {}),
    ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
  };

  const [items, total] = await Promise.all([
    db.order.findMany({
      where,
      // paymentRaw (ბანკის სრული პასუხი) გარეთ არ გადის
      select: {
        id: true, number: true, createdAt: true, status: true, paymentStatus: true, paymentMethod: true,
        customerName: true, customerPhone: true, customerEmail: true, customerId: true, companyName: true,
        deliveryMethod: true, deliveryCity: true, deliveryAddress: true, comment: true,
        subtotal: true, deliveryFee: true, total: true, invoiceNumber: true,
        items: { select: { sku: true, name: true, price: true, qty: true } },
      },
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
