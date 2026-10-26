import type { Locale } from "./config";

/**
 * ბაზის შიგთავსი — სახელი/აღწერა მიმდინარე ენაზე.
 * სახელის თარგმანის არარსებობისას ქართული ბრუნდება, ამიტომ ცარიელი ადგილი არ რჩება.
 */
type Named = { nameKa: string; nameEn?: string | null; nameRu?: string | null };
type Described = { descriptionKa?: string | null; descriptionEn?: string | null; descriptionRu?: string | null };

const GEO = /[Ⴀ-ჿ]/;

export function nameOf(x: Named, locale: Locale): string {
  if (locale === "en") return capital(x.nameEn?.trim()) || x.nameKa;
  if (locale === "ru") return capital(x.nameRu?.trim()) || x.nameKa;
  return x.nameKa;
}

/**
 * ფრაზების ლექსიკონით ნათარგმნი ძველი სახელები პატარა ასოთი იწყება („водонепроницаемый зажим…“).
 * „iPhone“, „eSIM“ ტიპის სახელს არ ვეხებით — მეორე ასოც პატარა უნდა იყოს.
 */
function capital(s: string | undefined): string | undefined {
  if (!s || !/^\p{Ll}\p{Ll}/u.test(s)) return s;
  return s[0].toUpperCase() + s.slice(1);
}

const ENTITIES: Record<string, string> = {
  bull: "•", nbsp: " ", quot: '"', amp: "&", lt: "<", gt: ">", ndash: "–", mdash: "—",
  laquo: "«", raquo: "»", deg: "°", times: "×", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
};

/**
 * მიმწოდებლის აღწერა ზოგჯერ HTML-ის ნარჩენებითაა (&bull;, <br>) — გვერდზე უბრალო ტექსტად ჩანს,
 * ამიტომ ვშიფრავთ და ტეგებს ვაშორებთ, ხაზების სტრუქტურა რჩება.
 */
export function plainText(s: string): string {
  return s
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * აღწერა მიმდინარე ენაზე. /en და /ru-ზე უთარგმნელ ქართულ აღწერას არ ვაჩვენებთ —
 * გვერდი ნახევრად ქართული რომ არ იყოს (მახასიათებლების ცხრილი ისედაც ნათარგმნია).
 */
export function descriptionOf(x: Described, locale: Locale): string | null {
  const ka = x.descriptionKa?.trim() || null;
  const v = (locale === "en" ? x.descriptionEn : locale === "ru" ? x.descriptionRu : ka)?.trim();
  if (v) return plainText(v);
  if (!ka || (locale !== "ka" && GEO.test(ka))) return null;
  return plainText(ka);
}
