import type { Locale } from "./config";

/**
 * ბაზის შიგთავსი — სახელი/აღწერა მიმდინარე ენაზე.
 * თარგმანის არარსებობისას ქართული ბრუნდება, ამიტომ ცარიელი ადგილი არ რჩება.
 */
type Named = { nameKa: string; nameEn?: string | null; nameRu?: string | null };
type Described = { descriptionKa?: string | null; descriptionEn?: string | null; descriptionRu?: string | null };

export function nameOf(x: Named, locale: Locale): string {
  if (locale === "en") return x.nameEn?.trim() || x.nameKa;
  if (locale === "ru") return x.nameRu?.trim() || x.nameKa;
  return x.nameKa;
}

export function descriptionOf(x: Described, locale: Locale): string | null {
  const v =
    locale === "en" ? x.descriptionEn : locale === "ru" ? x.descriptionRu : x.descriptionKa;
  return (v?.trim() || x.descriptionKa?.trim()) ?? null;
}
