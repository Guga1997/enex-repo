import { readFileSync } from "fs";
import path from "path";

/**
 * კატალოგის დასახელებების მანქანური თარგმანი ფრაზების ლექსიკონით.
 *
 * მიმწოდებლების სახელები შაბლონურია: ქართული ნაწილი („მართვადი სვიჩი -“) და
 * ლათინური მოდელი/მახასიათებლები. ამიტომ ვთარგმნით ქართულ მონაკვეთებს —
 * გრძელი ფრაზა ჯერ, რომ „მართვადი სვიჩი“ „სვიჩზე“ ადრე დაიჭიროს.
 *
 * თუ თარგმანის შემდეგ ქართული დარჩა, null ბრუნდება — ასეთ შემთხვევაში
 * საიტი ქართულ დასახელებას აჩვენებს (ნახევრად თარგმნილს არასდროს).
 */
type Entry = { en: string; ru: string };
const GEO = /[Ⴀ-ჿ]/;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RE_CACHE = new Map<string, RegExp>();
/** ფრაზა მხოლოდ მაშინ იცვლება, როცა მისი გვერდით ქართული ასო არ დგას */
function boundary(ka: string): RegExp {
  let re = RE_CACHE.get(ka);
  if (!re) {
    re = new RegExp(`(?<![\\u10A0-\\u10FF])${escape(ka)}(?![\\u10A0-\\u10FF])`, "g");
    RE_CACHE.set(ka, re);
  }
  re.lastIndex = 0;
  return re;
}

let CACHE: { phrases: [string, Entry][]; whole: Record<string, Entry> } | null = null;

function load() {
  if (CACHE) return CACHE;
  const dir = path.join(process.cwd(), "data");
  const read = (f: string): Record<string, Entry> => {
    try {
      return JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    } catch {
      return {};
    }
  };
  const phrases = Object.entries(read("phrases-i18n.json")).sort((a, b) => b[0].length - a[0].length);
  // სრული დამთხვევით: კატეგორიები და ბანერების ტექსტები
  CACHE = { phrases, whole: { ...read("category-i18n.json"), ...read("banner-i18n.json") } };
  return CACHE;
}

/** ერთი დასახელება; null — თუ სრულად ვერ ითარგმნა */
export function translateName(name: string, locale: "en" | "ru"): string | null {
  if (!GEO.test(name)) return name; // მთლიანად ლათინურია — თარგმანი არ სჭირდება
  const { phrases, whole } = load();

  const exact = whole[name.trim()];
  if (exact) return exact[locale];

  let out = name;
  for (const [ka, tr] of phrases) {
    if (!out.includes(ka)) continue;
    // მხოლოდ მთელი სიტყვა — თორემ „და“ სიტყვის შუაშიც ჩანაცვლდება („გადამრთველი“)
    out = out.replace(boundary(ka), tr[locale]);
    if (!GEO.test(out)) break;
  }
  if (GEO.test(out)) return null;
  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim();
}

/** კატეგორიის სახელი — ცალკე ლექსიკონი, სრული დამთხვევით */
export function translateCategory(name: string, locale: "en" | "ru"): string | null {
  const { whole } = load();
  return whole[name.trim()]?.[locale] ?? translateName(name, locale);
}
