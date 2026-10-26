import { createHash } from "crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { markOrderFailed, markOrderPaid } from "@/lib/orders";
import type { CreatePaymentInput, CreatePaymentResult } from "./bog";

/**
 * თიბისის ონლაინ გადახდა — Flitt (docs.flitt.com).
 *
 * გასააქტიურებლად: portal.flitt.com → მერჩანტის პარამეტრები → ძირითადი პროფილი.
 *   მერჩანტის ნომერი → FLITT_MERCHANT_ID
 *   გადახდის გასაღები → FLITT_SECRET_KEY
 * („საკრედიტო პირადი გასაღები“ ბარათზე ჩარიცხვისთვისაა — მაღაზიას არ სჭირდება.)
 *
 * სანამ ორივე ცვლადი არ არის, checkout-ში თიბისის ვარიანტი არ ჩანს.
 */

const API = "https://pay.flitt.com/api";

export function isFlittEnabled(): boolean {
  return Boolean(process.env.FLITT_MERCHANT_ID && process.env.FLITT_SECRET_KEY);
}

/**
 * ახალი მერჩანტი თიბისის გააქტიურებამდე სატესტო რეჟიმშია: გადახდის გვერდზე სატესტო
 * ბარათი წინასწარაა ჩაწერილი და „approved“ ნამდვილი ფულის გარეშე მოდის. სანამ
 * FLITT_LIVE=1 არ არის, ვარიანტს მხოლოდ ადმინში შესული ხედავს — მყიდველი სატესტო
 * ბარათით „გადახდილ“ შეკვეთას ვერ გააფორმებს.
 */
export async function canPayWithTbc(): Promise<boolean> {
  if (!isFlittEnabled()) return false;
  return process.env.FLITT_LIVE === "1" || Boolean(await getSession());
}

type Params = Record<string, unknown>;

/**
 * sha1(გასაღები|მნიშვნელობები ველის სახელის ანბანით) — ცარიელი ველი საერთოდ გამოტოვებულია,
 * 0 კი რჩება. signature და response_signature_string (სატესტო რეჟიმის მინიშნება) არ ითვლება.
 */
export function flittSignature(secret: string, params: Params): string {
  const values = Object.keys(params)
    .filter((k) => k !== "signature" && k !== "response_signature_string")
    .sort()
    .map((k) => params[k])
    .filter((v) => v !== undefined && v !== null && v !== "")
    .map(String);
  return createHash("sha1").update([secret, ...values].join("|")).digest("hex");
}

export function verifyFlittSignature(params: Params, secret = process.env.FLITT_SECRET_KEY ?? ""): boolean {
  return Boolean(secret) && typeof params.signature === "string" && params.signature === flittSignature(secret, params);
}

async function call(path: string, request: Params): Promise<Params> {
  const body = { ...request, merchant_id: process.env.FLITT_MERCHANT_ID };
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request: { ...body, signature: flittSignature(process.env.FLITT_SECRET_KEY!, body) } }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { response?: Params } | null;
  const r = data?.response;
  if (!res.ok || !r || r.response_status !== "success") {
    throw new Error(`Flitt ${path}: ${res.status} ${r?.error_code ?? ""} ${r?.error_message ?? ""}`.trim());
  }
  return r;
}

export async function createFlittPayment(input: CreatePaymentInput & { lang?: string }): Promise<CreatePaymentResult> {
  // order_id Flitt-ზე უნიკალური უნდა იყოს სამუდამოდ — ნომერს id-ის კუდი ემატება, ბაზის გასუფთავების შემდეგ ნომერი რომ გამეორდეს
  const flittOrderId = `${input.orderNumber}-${input.orderId.slice(-6)}`;
  const r = await call("checkout/url", {
    version: "1.0.1",
    order_id: flittOrderId,
    order_desc: `Enex — შეკვეთა ${input.orderNumber}`,
    amount: Math.round(input.amount * 100),
    currency: "GEL",
    lifetime: Math.max(5, input.ttlMinutes ?? 15) * 60,
    lang: input.lang ?? "ka",
    merchant_data: input.orderId,
    sender_email: input.buyer?.email,
    response_url: `${input.siteUrl}/api/payments/tbc/return?order=${input.orderId}`,
    server_callback_url: `${input.siteUrl}/api/payments/tbc/callback`,
  });
  if (typeof r.checkout_url !== "string") throw new Error("Flitt: checkout_url არ დაბრუნდა");
  return { paymentId: flittOrderId, redirectUrl: r.checkout_url };
}

export type FlittOrderStatus = "created" | "processing" | "declined" | "approved" | "expired" | "reversed";

/** სტატუსი პირდაპირ Flitt-ისგან — მყიდველი რომ დაბრუნდება და callback ჯერ არ მოსულა */
export async function fetchFlittStatus(flittOrderId: string): Promise<Params | null> {
  if (!isFlittEnabled()) return null;
  const r = await call("status/order_id", { version: "1.0.1", order_id: flittOrderId });
  return verifyFlittSignature(r) ? r : null;
}

/**
 * Flitt-ის პასუხი (callback, სტატუსის მოთხოვნა) → შეკვეთის სტატუსი.
 * ხელმოწერა უკვე შემოწმებულია. თანხა და ვალუტა შეკვეთას უნდა ემთხვეოდეს —
 * სხვა თანხაზე „approved“ ხელით გადასახედია და გადახდილად არ ინიშნება.
 */
export async function applyFlittResult(r: Params): Promise<"paid" | "failed" | "pending" | "mismatch" | "unknown"> {
  const order = await db.order.findFirst({
    where: { paymentMethod: "TBC", OR: [{ paymentId: String(r.order_id ?? "") }, { id: String(r.merchant_data ?? "") }] },
  });
  if (!order) return "unknown";

  const status = r.order_status as FlittOrderStatus | undefined;
  if (status === "approved") {
    if (Number(r.amount) !== Math.round(order.total * 100) || r.currency !== "GEL") {
      console.error(`Flitt: ${order.number} — თანხა არ ემთხვევა (${r.amount} ${r.currency}, შეკვეთა ${order.total} GEL)`);
      return "mismatch";
    }    await markOrderPaid(order.id, r);
    return "paid";
  }
  if (status === "declined" || status === "expired") {
    await markOrderFailed(order.id, r);
    return "failed";
  }
  return "pending";
}
