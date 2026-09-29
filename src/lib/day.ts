/**
 * დღის საზღვრები თბილისის დროით.
 *
 * სერვერი UTC-ზეა, საქართველო კი UTC+4 — და ზაფხულის დრო არ გვაქვს, ამიტომ
 * ოფსეტი მუდმივია. ამის გარეშე ღამის ორზე გაკეთებული შეკვეთა „გუშინდელში“
 * მოხვდებოდა.
 */

const OFFSET = "+04:00";

/** დღევანდელი თარიღი თბილისში, YYYY-MM-DD */
export function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });
}

export const isDay = (v: unknown): v is string => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));

/** [from, to] დღეების შუალედი — ჩათვლით, UTC მომენტებად */
export function dayRange(from: string, to = from) {
  const start = new Date(`${from}T00:00:00${OFFSET}`);
  const end = new Date(`${to}T00:00:00${OFFSET}`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

/** 29.09.2026 — თბილისის დღე, სერვერის დროის ზონის მიუხედავად */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}
