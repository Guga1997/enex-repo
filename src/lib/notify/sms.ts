/**
 * SMS. იგივე პრინციპი, რაც ელფოსტაზე — mock რეჟიმი, სანამ პროვაიდერი აირჩევა.
 * ნაგულისხმევი იმპლემენტაცია smsoffice.ge-სთვისაა (საქართველოში გავრცელებული).
 */
export const smsIsMocked = () => !process.env.SMS_API_KEY;

/** 5xxxxxxxx / 5xx-xx-xx-xx / +9955xxxxxxxx → 5xxxxxxxx */
export function normalizeGeoPhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  const local = d.startsWith("995") ? d.slice(3) : d;
  return /^5\d{8}$/.test(local) ? local : null;
}

export async function sendSms(phone: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const local = normalizeGeoPhone(phone);
  if (!local) return { ok: false, error: "ნომრის ფორმატი არასწორია" };

  if (smsIsMocked()) {
    console.log(`\n[MOCK SMS] → +995${local}\n  ${text}\n`);
    return { ok: true };
  }

  const url = new URL("https://smsoffice.ge/api/v2/send/");
  url.searchParams.set("key", process.env.SMS_API_KEY!);
  url.searchParams.set("destination", local);
  url.searchParams.set("sender", process.env.SMS_SENDER || "INFO");
  url.searchParams.set("content", text);

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) return { ok: false, error: `${res.status} ${await res.text()}` };
  return { ok: true };
}
