import { db } from "./db";
import { cancelOrder, markOrderFailed, markOrderPaid } from "./orders";
import { fetchPaymentStatus, isMockMode } from "./payments/bog";
import { applyFlittResult, fetchFlittStatus } from "./payments/flitt";

/** ბანკი პასუხს არ იძლევა / გადახდა ჯერ მუშავდება — მაქსიმუმ ამდენი ხანი ველოდებით ვადის შემდეგ */
const BANK_GRACE_MS = 60 * 60_000;

type Outcome = "paid" | "failed" | "pending" | "abandoned" | "unknown";

/**
 * ბარათით გადახდის სტატუსი პირდაპირ ბანკიდან. callback შეიძლება დაიკარგოს (ჩვენი
 * გადატვირთვა, ქსელი) — ვადის გასვლით გაუქმებამდე ბანკს ვეკითხებით, თორემ გადახდილი
 * შეკვეთა „ვადაგასულად“ მოინიშნებოდა და ნაშთი სხვას მიეყიდებოდა.
 */
async function askBank(o: { id: string; paymentMethod: string; paymentId: string | null }): Promise<Outcome> {
  if (!o.paymentId) return "unknown";
  if (o.paymentMethod === "BOG") {
    if (isMockMode()) return "unknown";
    const s = await fetchPaymentStatus(o.paymentId);
    // ბანკმა ვერ გვიპასუხა (5xx/429) — ჯერ არ ვაუქმებთ, ლოდინის ვადა მოქმედებს
    if (!s) return "pending";
    if (s.key === "completed") {
      await markOrderPaid(o.id, s.raw);
      return "paid";
    }
    if (s.key === "rejected") {
      await markOrderFailed(o.id, s.raw);
      return "failed";
    }
    // created — მყიდველმა გადახდის გვერდი არ დაასრულა; ბანკის ttl უკვე გავიდა → შეკვეთა უქმდება
    return s.key === "created" ? "abandoned" : "pending";
  }
  if (o.paymentMethod === "TBC") {
    const r = await fetchFlittStatus(o.paymentId);
    if (!r) return "pending";
    const res = await applyFlittResult(r);
    if (res === "paid" || res === "failed") return res;
    if (res === "mismatch") return "pending"; // ხელით გადასახედი — გაყიდვებს უკვე ეცნობა
    return r.order_status === "created" ? "abandoned" : "pending";
  }
  return "unknown";
}

/**
 * ვადაგასული რეზერვაციების გათავისუფლება — cron-იდან წუთში ერთხელ.
 * აბრუნებს, რამდენი შეკვეთა გაუქმდა.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = Date.now();
  const expired = await db.order.findMany({
    where: {
      reservedUntil: { lt: new Date(now) },
      paymentStatus: { not: "PAID" },
      status: "PENDING",
    },
    select: { id: true, number: true, paymentMethod: true, paymentId: true, reservedUntil: true },
  });

  let cancelled = 0;
  for (const o of expired) {
    const overdue = now - (o.reservedUntil?.getTime() ?? now) > BANK_GRACE_MS;
    let outcome: Outcome = "unknown";
    if (o.paymentMethod === "BOG" || o.paymentMethod === "TBC") {
      outcome = await askBank(o).catch((e) => {
        console.error(`${o.number}: ბანკის სტატუსი ვერ მოვიდა`, e instanceof Error ? e.message : e);
        return "pending" as const;
      });
      if (outcome === "paid" || outcome === "failed") continue;
      // ბანკი ჯერ ამუშავებს ან არ პასუხობს — ცოტა ხანს ველოდებით, მერე მაინც ვაუქმებთ
      if (outcome === "pending" && !overdue) continue;
    }
    await cancelOrder(o.id, "EXPIRED");
    cancelled++;
  }
  return cancelled;
}
