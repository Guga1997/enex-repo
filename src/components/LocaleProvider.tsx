"use client";

import { createContext, useContext, useMemo } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_LOCALE, stripLocale, type Locale } from "@/lib/i18n/config";
import { translate, type T } from "@/lib/i18n/dict";

const Ctx = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

/** მიმდინარე ენა კლიენტის კომპონენტში */
export const useLocale = (): Locale => useContext(Ctx);

/** const t = useT(); t("კალათა") */
export function useT(): T {
  const locale = useContext(Ctx);
  return useMemo<T>(() => (text, ...args) => translate(locale, text, ...args), [locale]);
}

/** მისამართი ენის პრეფიქსის გარეშე — შედარებისთვის („აქტიური გვერდი“) */
export function usePath(): string {
  const raw = usePathname() || "/";
  return stripLocale(raw).path;
}
