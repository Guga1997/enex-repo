import "server-only";
import { headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { translate, type T } from "./dict";

/**
 * მიმდინარე ენა — middleware სათაურში წერს. /api/… middleware-ს არ გადის და ენის
 * პრეფიქსიც არ აქვს — იქ ენა იმ გვერდისაა, საიდანაც მოთხოვნა მოვიდა (referer).
 */
export async function getLocale(): Promise<Locale> {
  const h = await headers();
  const v = h.get("x-locale");
  if (v) return isLocale(v) ? v : DEFAULT_LOCALE;
  try {
    const seg = new URL(h.get("referer") ?? "").pathname.split("/")[1] ?? "";
    return isLocale(seg) ? seg : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** სერვერულ კომპონენტში: const t = await getT(); t("კალათა") */
export async function getT(): Promise<T> {
  const locale = await getLocale();
  return (text, ...args) => translate(locale, text, ...args);
}

/** სტატიკური სათაური მიმდინარე ენაზე: export const generateMetadata = titleMeta("კალათა") */
export function titleMeta(title: string) {
  return async (): Promise<{ title: string }> => ({ title: (await getT())(title) });
}

/** ენაც და მთარგმნელიც ერთად, როცა ორივე სჭირდება */
export async function getI18n(): Promise<{ locale: Locale; t: T }> {
  const locale = await getLocale();
  return { locale, t: (text, ...args) => translate(locale, text, ...args) };
}
