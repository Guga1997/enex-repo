import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markOrderFailed, markOrderPaid } from "@/lib/orders";
import { verifyCallbackSignature } from "@/lib/payments/bog";

/**
 * BOG-ის callback. ბანკი აგზავნის POST-ს გადახდის ყოველ სტატუსის ცვლილებაზე.
 * ეს არის გადახდის ერთადერთი სანდო წყარო — success redirect-ს არ ვენდობით.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("callback-signature");

  if (!verifyCallbackSignature(raw, signature)) {
    console.warn("BOG callback: ხელმოწერა ვერ დადასტურდა");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: {
    body?: { external_order_id?: string; order_status?: { key?: string } };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const orderNumber = payload.body?.external_order_id;
  const statusKey = payload.body?.order_status?.key;
  if (!orderNumber) return NextResponse.json({ error: "no order id" }, { status: 400 });

  const order = await db.order.findUnique({ where: { number: orderNumber } });
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });

  if (statusKey === "completed") await markOrderPaid(order.id, payload);
  else if (statusKey === "rejected") await markOrderFailed(order.id, payload);

  return NextResponse.json({ ok: true });
}
