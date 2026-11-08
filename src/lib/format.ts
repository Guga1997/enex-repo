export function gel(amount: number): string {
  return `${amount.toFixed(2)}₾`;
}

const TBILISI_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tbilisi",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** DD.MM.YYYY თბილისის დროით — სერვერი UTC-შია და შუაღამის თარიღი წინა დღედ ჩანდა */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return TBILISI_DATE.format(date).split("/").join(".");
}

/** URL-safe slug — ქართული ასოები ტრანსლიტერაციით */
const KA_MAP: Record<string, string> = {
  ა: "a", ბ: "b", გ: "g", დ: "d", ე: "e", ვ: "v", ზ: "z", თ: "t", ი: "i",
  კ: "k", ლ: "l", მ: "m", ნ: "n", ო: "o", პ: "p", ჟ: "zh", რ: "r", ს: "s",
  ტ: "t", უ: "u", ფ: "f", ქ: "q", ღ: "gh", ყ: "y", შ: "sh", ჩ: "ch",
  ც: "ts", ძ: "dz", წ: "w", ჭ: "ch", ხ: "kh", ჯ: "j", ჰ: "h",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => KA_MAP[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
