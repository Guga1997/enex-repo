import { NextResponse } from "next/server";
import { applyFlittResult, verifyFlittSignature } from "@/lib/payments/flitt";

/**
 * თიბისის (Flitt) callback — გადახდის სტატუსის ცვლილებაზე POST, JSON.
 * 200-ის გარდა ყველა პასუხზე Flitt იმეორებს (2 წმ … 1 დღე), ამიტომ ხელმოწერის
 * შეცდომაზე 400, ჩვენი შეკვეთა რომ ვერ ვიპოვოთ — მაინც 200 (გამეორება არ უშველის).
 */
export async function POST(req: Request) {
  const raw = await req.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    // ზოგ მერჩანტს form-ით მოსდის — ორივე ვიღებთ
    payload = Object.fromEntries(new URLSearchParams(raw));
  }

  if (!verifyFlittSignature(payload)) {
    console.warn("Flitt callback: ხელმოწერა ვერ დადასტურდა", payload.order_id);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const result = await applyFlittResult(payload);
  if (result === "unknown") console.warn("Flitt callback: შეკვეთა ვერ მოიძებნა", payload.order_id);
  return NextResponse.json({ ok: true, result });
}
