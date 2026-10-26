import { readFileSync } from "fs";
import path from "path";
import type { Locale } from "./config";
import { translate } from "./dict";

/**
 * მახასიათებლების (სახელი და მნიშვნელობა) თარგმანი სერვერზე.
 *
 * ათასობით მნიშვნელობა ბრაუზერის ლექსიკონში (dict.ts) არ ეტევა, ამიტომ:
 *   1. data/attr-i18n.json — სრული დამთხვევა („კორპუსის მასალა“, „მეტალი + პლასტმასი“)
 *   2. ერთეულების წესები — „2.8 მმ“ → „2.8 mm“, „-10°C-დან +55°C-მდე“ → „-10°C to +55°C“
 *   3. dict.ts — ინტერფეისის ზოგადი სიტყვები („დიახ“)
 * ქართული თუ მაინც დარჩა, ორიგინალი ბრუნდება — ნახევრად თარგმნილი არასდროს.
 */

const GEO = /[Ⴀ-ჿ]/;
type Entry = { en: string; ru: string };

let TABLE: Record<string, Entry> | null = null;
function table(): Record<string, Entry> {
  if (!TABLE) {
    try {
      TABLE = JSON.parse(readFileSync(path.join(process.cwd(), "data", "attr-i18n.json"), "utf8"));
    } catch {
      TABLE = {};
    }
  }
  return TABLE!;
}

/** ერთეული რიცხვის შემდეგ: „30 მ“, „4მპ“, „12ვ“ — გრძელი ჯერ, რომ „მმ“ „მ“-ზე ადრე დაიჭიროს */
const UNITS: [string, string, string][] = [
  ["კვტ.სთ", "kWh", "кВт·ч"],
  ["ვტ.სთ", "Wh", "Вт·ч"],
  ["ა.სთ", "Ah", "А·ч"],
  ["მმ²", "mm²", "мм²"],
  ["მმ", "mm", "мм"],
  ["სმ", "cm", "см"],
  ["კმ", "km", "км"],
  ["მ²", "m²", "м²"],
  ["მ³", "m³", "м³"],
  ["მპ", "MP", "Мп"],
  ["ტბ", "TB", "ТБ"],
  ["გბ", "GB", "ГБ"],
  ["მბ", "MB", "МБ"],
  ["კვტ", "kW", "кВт"],
  ["ვტ", "W", "Вт"],
  ["კვა", "kVA", "кВА"],
  ["კგ", "kg", "кг"],
  ["გრ", "g", "г"],
  ["სთ", "h", "ч"],
  ["წთ", "min", "мин"],
  ["წმ", "s", "с"],
  ["ლ", "L", "л"],
  ["ც", "pcs", "шт"],
  ["მ", "m", "м"],
  ["ვ", "V", "В"],
  ["ა", "A", "А"],
];
const UNIT_RE = new RegExp(
  `(\\d)\\s?(${UNITS.map((u) => u[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\.?(?![Ⴀ-ჿ])`,
  "g"
);
const UNIT_OF = new Map(UNITS.map(([ka, en, ru]) => [ka, { en, ru }]));

function byRules(text: string, locale: "en" | "ru"): string {
  // „5 GHz: 2402 Mbps-მდე“ — წინსართი ორწერტილის შემდეგ ჯდება: „5 GHz: up to 2402 Mbps“
  const [, label = "", value] = text.match(/^((?:[^:]*:\s+)?)(.*)$/s)!;
  let s = value;
  // „X-დან Y-მდე“ → „X to Y“ / „от X до Y“
  s = s.replace(/^(.+?)-დან\s*(.+?)-მდე$/, (_, a, b) => (locale === "en" ? `${a} to ${b}` : `от ${a} до ${b}`));
  // „60მ-მდე“ → „up to 60 m“
  s = s.replace(/^(.+?)-მდე$/, (_, a) => (locale === "en" ? `up to ${a}` : `до ${a}`));
  s = s.replace(/^(.+?)-დან$/, (_, a) => (locale === "en" ? `from ${a}` : `от ${a}`));
  s = s.replace(UNIT_RE, (_, d, u) => `${d} ${UNIT_OF.get(u)![locale]}`);
  return label + s;
}

function lookup(text: string, locale: "en" | "ru"): string | null {
  const key = text.trim();
  const hit = table()[key]?.[locale];
  if (hit) return hit;
  const ui = translate(locale, key);
  return ui !== key ? ui : null;
}

/** მახასიათებლის სახელი ან მნიშვნელობა მიმდინარე ენაზე */
export function translateAttr(text: string, locale: Locale): string {
  if (locale === "ka" || !GEO.test(text)) return text;
  const exact = lookup(text, locale);
  if (exact) return exact;
  const ruled = byRules(text, locale);
  if (!GEO.test(ruled)) return ruled;
  // ჩამონათვალი („30 მ, ფერადი“; „5 GHz: …-მდე, 2.4 GHz: …-მდე“) — თითო ნაწილი ცალკე, ორიგინალიდან
  const parts = text.split(/(\s*[,;/+]\s*)/);
  const joined = parts.map((p) => (GEO.test(p) ? lookup(p, locale) ?? byRules(p, locale) : p)).join("");
  return GEO.test(joined) ? text : joined;
}

/** თარგმანის რუკა კლიენტის კომპონენტისთვის (ფილტრები) — მხოლოდ ის, რაც ქართულია */
export function attrLabels(texts: Iterable<string>, locale: Locale): Record<string, string> {
  const out: Record<string, string> = {};
  if (locale === "ka") return out;
  for (const t of texts) {
    const tr = translateAttr(t, locale);
    if (tr !== t) out[t] = tr;
  }
  return out;
}
