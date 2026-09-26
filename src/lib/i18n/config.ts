/** საიტის ენები. ქართული ნაგულისხმევია და მისამართში პრეფიქსი არ აქვს. */
export const LOCALES = ["ka", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ka";
/** მისამართის პრეფიქსები — /en/..., /ru/...; ქართული ფესვშია */
export const PREFIXED = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

export const LOCALE_LABEL: Record<Locale, string> = { ka: "ქარ", en: "ENG", ru: "РУС" };
export const LOCALE_NAME: Record<Locale, string> = { ka: "ქართული", en: "English", ru: "Русский" };
/** <html lang> და og:locale */
export const HTML_LANG: Record<Locale, string> = { ka: "ka", en: "en", ru: "ru" };
export const OG_LOCALE: Record<Locale, string> = { ka: "ka_GE", en: "en_US", ru: "ru_RU" };

export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

/** მისამართს ენის პრეფიქსს ადებს: ("/catalog", "en") → "/en/catalog" */
export function withLocale(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return path;
  if (!path.startsWith("/")) return path; // გარე ბმული ან #ღუზა
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** პრეფიქსს აშორებს: "/en/catalog" → { locale: "en", path: "/catalog" } */
export function stripLocale(path: string): { locale: Locale; path: string } {
  const seg = path.split("/")[1] ?? "";
  if (isLocale(seg) && seg !== DEFAULT_LOCALE) {
    const rest = path.slice(seg.length + 1);
    return { locale: seg, path: rest === "" ? "/" : rest };
  }
  return { locale: DEFAULT_LOCALE, path };
}
