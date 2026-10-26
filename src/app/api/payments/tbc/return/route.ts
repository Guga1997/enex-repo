import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyFlittResult, fetchFlittStatus } from "@/lib/payments/flitt";

/**
 * Flitt-ის გვერდიდან დაბრუნება (response_url). ბრაუზერი აქ POST-ით მოდის, Next-ის
 * გვერდი კი POST-ს ვერ იღებს — ამიტომ ცალკე მარშრუტი. ფორმის ველებს არ ვენდობით:
 * სტატუსს Flitt-ს სერვერიდან ვეკითხებით და შეკვეთის გვერდზე 303-ით ვაბრუნებთ.
 */
async function back(req: Request) {
  const url = new URL(req.url);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
  const order = await db.order.findUnique({
    where: { id: url.searchParams.get("order") ?? "" },
    select: { id: true, paymentId: true, paymentStatus: true },
  });
  if (!order) return NextResponse.redirect(`${site}/`, 303);

  let flag = "";
  if (order.paymentStatus === "PAID") flag = "?paid=1";
  else if (order.paymentId) {
    const status = await fetchFlittStatus(order.paymentId).catch(() => null);
    const result = status ? await applyFlittResult(status) : "pending";
    flag = result === "paid" ? "?paid=1" : result === "failed" ? "?failed=1" : "";
  }
  return NextResponse.redirect(`${site}/order/${order.id}${flag}`, 303);
}

export const GET = back;
export const POST = back;
