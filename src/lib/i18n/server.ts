import "server-only";
import { headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { translate, type T } from "./dict";

/** მიმდინარე ენა — middleware სათაურში წერს */
export async function getLocale(): Promise<Locale> {
  const v = (await headers()).get("x-locale") ?? "";
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

/** სერვერულ კომპონენტში: const t = await getT(); t("კალათა") */
export async function getT(): Promise<T> {
  const locale = await getLocale();
  return (text, ...args) => translate(locale, text, ...args);
}

/** ენაც და მთარგმნელიც ერთად, როცა ორივე სჭირდება */
export async function getI18n(): Promise<{ locale: Locale; t: T }> {
  const locale = await getLocale();
  return { locale, t: (text, ...args) => translate(locale, text, ...args) };
}
