import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/customer-auth";
import { effectivePrice } from "@/lib/pricing";
import { isPurchasable } from "@/lib/stock";
import { FREE_DELIVERY_FROM } from "@/lib/constants";

/**
 * კალათის სერვერული გადათვლა: ფასი მომხმარებლის დონით, წონა და მოცულობა.
 * localStorage-ში დაფიქსირებულ ფასს არ ვენდობით — ის დამატების მომენტისაა.
 */
const schema = z.object({
  items: z
    .array(z.object({ productId: z.string(), qty: z.number().int().min(1).max(999) }))
    .max(200),
  deliveryMethod: z.enum(["COURIER", "PICKUP"]).optional(),
});

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "არავალიდური მოთხოვნა" }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "არავალიდური მოთხოვნა" }, { status: 400 });
  }
  const { items, deliveryMethod = "COURIER" } = parsed.data;

  if (items.length === 0) {
    return NextResponse.json({
      lines: [], subtotal: 0, retailSubtotal: 0, saved: 0,
      deliveryFee: 0, total: 0, weightKg: 0, volumeM3: 0, isDealer: false,
    });
  }

  const viewer = await getCurrentUser();
  const products = await db.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, isActive: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = items.flatMap((item) => {
    const p = byId.get(item.productId);
    if (!p) return [];
    const price = effectivePrice(p, viewer);
    return [{
      productId: p.id,
      name: p.nameKa,
      sku: p.sku,
      qty: item.qty,
      unitPrice: price.value,
      retailPrice: price.retail,
      lineTotal: Math.round(price.value * item.qty * 100) / 100,
      weightKg: p.weightKg ? Math.round(p.weightKg * item.qty * 1000) / 1000 : null,
      volumeM3: p.volumeM3 ? Math.round(p.volumeM3 * item.qty * 1000) / 1000 : null,
      /* ეტალონ საიტის წითელი შენიშვნა — მოთხოვნილი რაოდენობა საწყობში არ არის */
      overStock:
        p.stockStatus === "IN_STOCK" && item.qty > p.stockQty ? p.stockQty : null,
      purchasable: isPurchasable(p),
    }];
  });

  const round = (n: number) => Math.round(n * 100) / 100;
  const subtotal = round(lines.reduce((s, l) => s + l.lineTotal, 0));
  const retailSubtotal = round(lines.reduce((s, l) => s + l.retailPrice * l.qty, 0));
  const deliveryFee = deliveryMethod === "PICKUP" || subtotal >= FREE_DELIVERY_FROM ? 0 : 15;

  return NextResponse.json({
    lines,
    subtotal,
    retailSubtotal,
    saved: round(retailSubtotal - subtotal),
    deliveryFee,
    total: round(subtotal + deliveryFee),
    weightKg: round(lines.reduce((s, l) => s + (l.weightKg ?? 0), 0)),
    volumeM3: Math.round(lines.reduce((s, l) => s + (l.volumeM3 ?? 0), 0) * 1000) / 1000,
    isDealer: viewer?.priceTier === "DEALER",
  });
}
