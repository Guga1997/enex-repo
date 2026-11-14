import { db } from "../db";
import { LOCALES, type Locale } from "../i18n/config";
import { CONTACT_DEFAULT } from "./texts";

/**
 * AI ჩატის პარამეტრები — ადმინის „AI ჩატები“ გვერდიდან იცვლება, დეპლოის გარეშე.
 * ბაზაშია (Setting, key "aiChat"); ერთი პროცესია, ამიტომ მეხსიერებაში ვინახავთ და
 * შენახვისას ვანულებთ — როგორც pricing-settings.ts.
 */

const KEY = "aiChat";
const TTL_MS = 30_000;

export type ChatSettings = {
  enabled: boolean;
  /** რამდენ შეკითხვას პასუხობს AI ერთ მომხმარებელს (ერთ საუბარში) */
  limit: number;
  /** იგივე — ერთი IP-დან 24 საათში (ახალი ჩანართი ან წაშლილი cookie ლიმიტს არ ანულებს) */
  ipLimit: number;
  /** ლიმიტის ამოწურვისას ნაჩვენები საკონტაქტო ტექსტი, საიტის ენაზე */
  contact: Record<Locale, string>;
};

export const LIMIT_MAX = 50;
export const CONTACT_MAX = 600;

export const DEFAULTS: ChatSettings = { enabled: true, limit: 3, ipLimit: 3, contact: { ...CONTACT_DEFAULT } };

const int = (v: unknown, fallback: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, LIMIT_MAX) : fallback;
};

export function sanitize(raw: unknown): ChatSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const c = (r.contact && typeof r.contact === "object" ? r.contact : {}) as Record<string, unknown>;
  const contact = { ...CONTACT_DEFAULT };
  for (const l of LOCALES) {
    const v = typeof c[l] === "string" ? (c[l] as string).replace(/\r\n/g, "\n").trim().slice(0, CONTACT_MAX) : "";
    if (v) contact[l] = v;
  }
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULTS.enabled,
    limit: int(r.limit, DEFAULTS.limit),
    ipLimit: int(r.ipLimit, DEFAULTS.ipLimit),
    contact,
  };
}

let cache: { at: number; value: ChatSettings } | null = null;

export async function getChatSettings(): Promise<ChatSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value = DEFAULTS;
  try {
    const row = await db.setting.findUnique({ where: { key: KEY } });
    if (row) value = sanitize(JSON.parse(row.value));
  } catch {
    // ბაზა რომ ვერ წავიკითხოთ, ჩატი ნაგულისხმევი პარამეტრებით იმუშავებს
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function saveChatSettings(next: unknown): Promise<ChatSettings> {
  const clean = sanitize(next);
  const value = JSON.stringify(clean);
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
  cache = { at: Date.now(), value: clean };
  return clean;
}
