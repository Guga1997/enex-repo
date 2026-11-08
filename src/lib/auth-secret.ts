/**
 * სესიის ტოკენების საერთო საიდუმლო და „ადრესატი“ (aud).
 *
 * ადმინის და მყიდველის cookie ერთი გასაღებით იწერება — ამიტომ თითოეულს თავისი aud აქვს:
 * მყიდველის ტოკენი admin_session-ში ჩასმული აღარ მიიღება (ადრე როლის გარეშე ტოკენი
 * ადმინად ითვლებოდა). middleware-შიც გამოიყენება — Node-ის მოდულები აქ არ უნდა შემოვიდეს.
 */
export const ADMIN_AUD = "enex:admin";
export const CUSTOMER_AUD = "enex:customer";

const DEV_SECRET = "dev-only-insecure-secret-change-me!!";

export function authSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET ?? "";
  if (s.length < 32) {
    // production-ში ცნობილი სათადარიგო გასაღებით არასდროს — ნებისმიერი ადმინის ტოკენს მოაწერდა
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET არ არის ან 32 სიმბოლოზე მოკლეა");
    return new TextEncoder().encode(s || DEV_SECRET);
  }
  return new TextEncoder().encode(s);
}

/**
 * მყიდველის ტოკენი: ახალი — aud=customer; ძველი (aud-მდე გაცემული, 30 დღე) — aud-ის და
 * role-ის გარეშე. ადმინის ტოკენი (role ან aud=admin) აქ არ გაივლის.
 */
export function isCustomerPayload(p: Record<string, unknown>): boolean {
  if (p.aud !== undefined) return p.aud === CUSTOMER_AUD;
  return p.role === undefined;
}
