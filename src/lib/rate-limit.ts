import { headers } from "next/headers";

/**
 * მოთხოვნების შეზღუდვა — მეხსიერებაში, ერთი სერვერისთვის.
 * ფანჯარა მოცურავია: ბოლო `windowMs`-ში `limit`-ზე მეტი არ დაიშვება.
 *
 * ერთ პროცესზე ეს საკმარისია. რამდენიმე ინსტანსზე გადასვლისას
 * Redis-ზე გადადის — ინტერფეისი უცვლელი რჩება.
 */
type Bucket = number[]; // მოთხოვნების დროები, მილიწამებში

const buckets = new Map<string, Bucket>();

// მეხსიერება უსასრულოდ არ უნდა გაიზარდოს — ძველ გასაღებებს პერიოდულად ვასუფთავებთ
let lastSweep = Date.now();
function sweep(now: number, maxWindowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, times] of buckets) {
    const live = times.filter((t) => now - t < maxWindowMs);
    if (live.length) buckets.set(key, live);
    else buckets.delete(key);
  }
}

export type RateResult = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * `key` — რას ვზღუდავთ (ip, user id, ელფოსტა…), `limit` მოთხოვნა `windowMs`-ში.
 * წარმატებული შემოწმება მოთხოვნას ითვლის; უარყოფილი — არა.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now, Math.max(windowMs, 60 * 60_000));

  const times = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (times.length >= limit) {
    const oldest = times[0];
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  times.push(now);
  buckets.set(key, times);
  return { ok: true };
}

/** კლიენტის IP nginx-ის ჰედერებიდან; პირდაპირ კავშირზე — უცნობი */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

/** ადამიანური ტექსტი ლოდინის დროზე */
export function retryText(sec: number): string {
  if (sec < 60) return `სცადე ${sec} წამში`;
  const min = Math.ceil(sec / 60);
  return `სცადე ${min} წუთში`;
}

/* ─── ლიმიტები ერთ ადგილას, რომ ერთმანეთს შევადაროთ ─── */
export const LIMITS = {
  /** კოდის ხელახლა გაგზავნა — ყოველი SMS ფასიანია */
  resendPerUser: { limit: 1, windowMs: 60_000 },
  resendPerUserHour: { limit: 5, windowMs: 60 * 60_000 },
  /** რეგისტრაცია — თითო რეგისტრაცია ორი კოდია */
  registerPerIp: { limit: 5, windowMs: 60 * 60_000 },
  /** შესვლის მცდელობები — პაროლის გამოცნობის წინააღმდეგ */
  loginPerIp: { limit: 20, windowMs: 15 * 60_000 },
  loginPerAccount: { limit: 8, windowMs: 15 * 60_000 },
  /** შეკვეთა — რეზერვაცია ნაშთს იკავებს, ბოტს არ უნდა შეეძლოს მისი დაბლოკვა */
  orderPerUser: { limit: 5, windowMs: 10 * 60_000 },
  orderPerIp: { limit: 20, windowMs: 60 * 60_000 },
} as const;
