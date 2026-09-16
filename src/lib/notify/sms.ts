/**
 * SMS — პროვაიდერი .env-ით ირჩევა, ინტერფეისი ერთია:
 *   SMS_PROVIDER=brevo      → api.brevo.com   (SMS_API_KEY = Brevo-ს API გასაღები, SMS_SENDER)
 *   SMS_PROVIDER=ubill      → api.ubill.dev   (SMS_API_KEY + SMS_BRAND_ID)
 *   SMS_PROVIDER=smsoffice  → smsoffice.ge    (SMS_API_KEY + SMS_SENDER)
 *   გასაღების გარეშე        → mock, კონსოლში იბეჭდება
 *
 * Brevo-ს SMS-ის გასაღები SMTP-ის გასაღები არ არის — ცალკე „API key“ იქმნება.
 */
export const smsIsMocked = () => !process.env.SMS_API_KEY;

export type SmsProviderName = "brevo" | "ubill" | "smsoffice" | "mock";

export const smsProvider = (): SmsProviderName => {
  if (!process.env.SMS_API_KEY) return "mock";
  const p = process.env.SMS_PROVIDER;
  return p === "ubill" || p === "smsoffice" ? p : "brevo";
};

/** 5xxxxxxxx / 5xx-xx-xx-xx / +9955xxxxxxxx → 5xxxxxxxx */
export function normalizeGeoPhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  const local = d.startsWith("995") ? d.slice(3) : d;
  return /^5\d{8}$/.test(local) ? local : null;
}

export type SmsResult = { ok: boolean; id?: string; error?: string };

/* ────────────────────────────── Brevo ────────────────────────────── */

async function sendViaBrevo(local: string, text: string): Promise<SmsResult> {
  // გამომგზავნის სახელი — 11 ლათინურ სიმბოლომდე, ან ნომერი
  const sender = (process.env.SMS_SENDER || "Enex").slice(0, 11);

  const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: {
      "api-key": process.env.SMS_API_KEY!,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender,
      recipient: `995${local}`,
      content: text,
      type: "transactional",
      tag: "verification",
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    messageId?: number | string;
    reference?: string;
    remainingCredits?: number;
    code?: string;
    message?: string;
  };

  if (!res.ok) {
    const hint =
      json.code === "not_enough_credits"
        ? "SMS კრედიტი ამოიწურა — Brevo-ში შეავსე"
        : json.code === "unauthorized"
          ? "API გასაღები არასწორია (SMTP-ის გასაღები არ გამოდგება)"
          : json.message ?? `Brevo HTTP ${res.status}`;
    return { ok: false, error: hint };
  }
  if (typeof json.remainingCredits === "number" && json.remainingCredits < 20) {
    console.warn(`Brevo SMS: დარჩა ${json.remainingCredits} კრედიტი`);
  }
  return { ok: true, id: String(json.messageId ?? json.reference ?? "") };
}

/* ────────────────────────────── uBill ────────────────────────────── */

const UBILL_ERRORS: Record<number, string> = {
  10: "brandID ვერ მოიძებნა — SMS_BRAND_ID შეამოწმე",
  20: "ნომერი არ არის მითითებული",
  30: "ტექსტი ცარიელია",
  40: "ბალანსი არასაკმარისია — uBill-ზე შეავსე",
  50: "ვალიდური ნომერი არ არის",
  60: "sendTime-ის ფორმატი არასწორია",
};

async function sendViaUbill(local: string, text: string): Promise<SmsResult> {
  const brandID = Number(process.env.SMS_BRAND_ID);
  if (!brandID) return { ok: false, error: "SMS_BRAND_ID არ არის — uBill-ის პანელში Brand-ის ნომერია" };

  const res = await fetch("https://api.ubill.dev/v1/sms/send", {
    method: "POST",
    headers: { key: process.env.SMS_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      brandID,
      numbers: [`995${local}`],
      text,
      otp: true, // ერთჯერადი კოდი — stop-list-ს არ ექვემდებარება
    }),
  });
  if (!res.ok) return { ok: false, error: `uBill HTTP ${res.status}` };

  const json = (await res.json()) as { statusID?: number; smsID?: number; message?: string };
  if (json.statusID !== 0) {
    return { ok: false, error: UBILL_ERRORS[json.statusID ?? -1] ?? json.message ?? `uBill სტატუსი ${json.statusID}` };
  }
  return { ok: true, id: String(json.smsID ?? "") };
}

/* ──────────────────────────── smsoffice ─────────────────────────── */

async function sendViaSmsOffice(local: string, text: string): Promise<SmsResult> {
  const url = new URL("https://smsoffice.ge/api/v2/send/");
  url.searchParams.set("key", process.env.SMS_API_KEY!);
  url.searchParams.set("destination", local);
  url.searchParams.set("sender", process.env.SMS_SENDER || "INFO");
  url.searchParams.set("content", text);

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) return { ok: false, error: `smsoffice HTTP ${res.status}` };
  return { ok: true };
}

/* ─────────────────────────────────────────────────────────────────── */

export async function sendSms(phone: string, text: string): Promise<SmsResult> {
  const local = normalizeGeoPhone(phone);
  if (!local) return { ok: false, error: "ნომრის ფორმატი არასწორია" };

  switch (smsProvider()) {
    case "brevo":
      return sendViaBrevo(local, text);
    case "ubill":
      return sendViaUbill(local, text);
    case "smsoffice":
      return sendViaSmsOffice(local, text);
    default:
      console.log(`\n[MOCK SMS] → +995${local}\n  ${text}\n`);
      return { ok: true, id: "mock" };
  }
}
