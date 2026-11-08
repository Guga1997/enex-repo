/**
 * მხოლოდ საიტის შიდა გზა (?next=, return) — გარე საიტზე გადამისამართება არ უნდა მოხდეს.
 * "//evil.com" და "/\evil.com" ბრაუზერისთვის გარე მისამართია, ამიტომ ორივე უარყოფილია.
 */
export function safePath(v: unknown, fallback = "/"): string {
  const s = String(v ?? "").trim();
  if (!s.startsWith("/") || /^\/[\\/]/.test(s) || s.includes("\\") || /[\u0000-\u001f]/.test(s)) return fallback;
  try {
    const u = new URL(s, "https://enex.ge");
    if (u.origin !== "https://enex.ge") return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
