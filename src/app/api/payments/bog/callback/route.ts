import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markOrderFailed, markOrderPaid } from "@/lib/orders";
import { verifyCallbackSignature } from "@/lib/payments/bog";
import { notifySalesPaymentProblem } from "@/lib/notify/sales";

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
    body?: {
      order_id?: string;
      external_order_id?: string;
      order_status?: { key?: string };
      purchase_units?: { transfer_amount?: string | number; request_amount?: string | number; currency_code?: string };
    };
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
  // ჩვენთან არ არის — გამეორება არ უშველის, ბანკი 200-ს ელოდება
  if (!order) {
    console.warn("BOG callback: შეკვეთა ვერ მოიძებნა", orderNumber);
    return NextResponse.json({ ok: true, result: "unknown" });
  }

  if (statusKey === "completed") {
    // ხელმოწერილი callback-იც ჩვენს შეკვეთას უნდა ეკუთვნოდეს და თანხაც უნდა ემთხვეოდეს
    const body = payload.body!;
    const paid = Number(body.purchase_units?.transfer_amount ?? body.purchase_units?.request_amount);
    const currency = body.purchase_units?.currency_code;
    const problems = [
      order.paymentId && body.order_id && body.order_id !== order.paymentId ? `ბანკის შეკვეთის id ${body.order_id} ≠ ${order.paymentId}` : "",
      Number.isFinite(paid) && Math.round(paid * 100) !== Math.round(order.total * 100) ? `თანხა ${paid}, შეკვეთა ${order.total}` : "",
      currency && currency !== "GEL" ? `ვალუტა ${currency}` : "",
    ].filter(Boolean);
    if (problems.length) {
      if (order.paymentStatus !== "PAID") await notifySalesPaymentProblem(order.number, "BOG: " + problems.join("; ")).catch(() => {});
      return NextResponse.json({ ok: true, result: "mismatch" });
    }
    await markOrderPaid(order.id, payload);
  }
  else if (statusKey === "rejected") await markOrderFailed(order.id, payload);
  // თანხა მთლიანად დაბრუნდა (ადმინიდან ან ბანკის კაბინეტიდან) — გადახდილად აღარ ჩანს
  else if (statusKey === "refunded") {
    await db.order.updateMany({ where: { id: order.id, paymentStatus: "PAID" }, data: { paymentStatus: "REFUNDED" } });
  }

  return NextResponse.json({ ok: true });
}
