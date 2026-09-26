/**
 * მიმართულების ფერი — ნავიგაციაში ხატულის უჯრა ამ ფერში იღებება.
 *
 * ფერები თვალით არ აგვირჩევია — დარგში მიღებული/სტანდარტული ფერებია:
 *   ენერგო          — ყვითელი: ელექტროობის გამაფრთხილებელი ფერი (ISO 3864 / IEC 60417).
 *   უსაფრთხოება     — წითელი: ხანძარსაწინააღმდეგო და სიგნალიზაციის აღჭურვილობა (ISO 3864, EN 54).
 *   LAN & WAN       — ლურჯი: TIA-606 ჰორიზონტალური (სამუშაო ადგილის) კაბელი; patch კაბელიც ლურჯია.
 *   ოპტიკური ქსელი  — იისფერი: TIA-598 ბოჭკოს გარსის ფერი OM4-ისთვის („Erika violet").
 *   სასტუმრო        — ბორდო/ვარდისფერი: hospitality-ის ტრადიციული ფერი.
 *   აუდიო-ვიდეო     — მწვანე: კომპონენტური ვიდეოს Y-არხის კონექტორი.
 *   მონაცემთა შენახვა — ნაცრისფერი: სერვერული კარადის ფერი.
 *
 * ღია ტონი უჯრაზე, იმავე ფერის მუქი — ხატულაზე, რომ ფონზე მკაფიოდ ჩანდეს.
 * Tailwind-ს კლასები სტატიკურად უნდა დაინახოს, ამიტომ hover-ვარიანტი ცალკე წერია.
 */

export type SegmentTheme = {
  /** ხატულის უჯრა */
  tint: string;
  tintHover: string;
  /** ხატულა უჯრაში */
  ink: string;
  inkHover: string;
  /** ქვედა ხაზი */
  line: string;
  lineHover: string;
};

const THEMES: { test: RegExp; theme: SegmentTheme }[] = [
  {
    test: /ენერგო|კვება|generator|energo/,
    theme: {
      tint: "bg-amber-200", tintHover: "group-hover:bg-amber-200",
      ink: "text-amber-700", inkHover: "group-hover:text-amber-700",
      line: "border-amber-500", lineHover: "group-hover:border-amber-500",
    },
  },
  {
    test: /უსაფრთხო|დაცვ|კამერ|security/,
    theme: {
      tint: "bg-red-200", tintHover: "group-hover:bg-red-200",
      ink: "text-red-700", inkHover: "group-hover:text-red-700",
      line: "border-red-500", lineHover: "group-hover:border-red-500",
    },
  },
  {
    test: /ოპტიკ|optik|ბოჭკ/,
    theme: {
      tint: "bg-violet-200", tintHover: "group-hover:bg-violet-200",
      ink: "text-violet-700", inkHover: "group-hover:text-violet-700",
      line: "border-violet-500", lineHover: "group-hover:border-violet-500",
    },
  },
  {
    test: /lan|wan|ქსელ|სვიჩ|როუტერ/,
    theme: {
      tint: "bg-blue-200", tintHover: "group-hover:bg-blue-200",
      ink: "text-blue-700", inkHover: "group-hover:text-blue-700",
      line: "border-blue-500", lineHover: "group-hover:border-blue-500",
    },
  },
  {
    test: /სასტუმრო|sastumro|hotel/,
    theme: {
      tint: "bg-rose-200", tintHover: "group-hover:bg-rose-200",
      ink: "text-rose-700", inkHover: "group-hover:text-rose-700",
      line: "border-rose-500", lineHover: "group-hover:border-rose-500",
    },
  },
  {
    test: /აუდიო|ვიდეო|audio|video/,
    theme: {
      tint: "bg-emerald-200", tintHover: "group-hover:bg-emerald-200",
      ink: "text-emerald-700", inkHover: "group-hover:text-emerald-700",
      line: "border-emerald-500", lineHover: "group-hover:border-emerald-500",
    },
  },
  {
    test: /მონაცემ|შენახვ|სერვერ|დისკ|storage/,
    theme: {
      tint: "bg-slate-300", tintHover: "group-hover:bg-slate-300",
      ink: "text-slate-700", inkHover: "group-hover:text-slate-700",
      line: "border-slate-500", lineHover: "group-hover:border-slate-500",
    },
  },
];

/** ნაგულისხმევი — ფირმის ფერი, რომ ახალ სეგმენტსაც რამე ჰქონდეს */
const FALLBACK: SegmentTheme = {
  tint: "bg-brand-200", tintHover: "group-hover:bg-brand-200",
  ink: "text-brand-700", inkHover: "group-hover:text-brand-700",
  line: "border-brand-500", lineHover: "group-hover:border-brand-500",
};

export function segmentTheme(name: string, slug = ""): SegmentTheme {
  const s = `${name} ${slug}`.toLowerCase();
  return THEMES.find((t) => t.test.test(s))?.theme ?? FALLBACK;
}
