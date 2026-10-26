import { LOCALES, withLocale, type Locale } from "./i18n/config";
import { translate } from "./i18n/dict";
import { descriptionOf, nameOf } from "./i18n/content";
import { translateAttr } from "./i18n/attributes";
/**
 * SEO-ს საერთო ნაწილი: საიტის მისამართი, სტრუქტურირებული მონაცემები (JSON-LD),
 * აღწერის ავტომატური აწყობა იქ, სადაც ხელით არავის დაუწერია.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://enex.ge").replace(/\/$/, "");
export const SITE_NAME = "Enex";
export const DEFAULT_DESCRIPTION =
  "ვიდეო-მეთვალყურეობა, ქსელური მოწყობილობები, ენერგო უზრუნველყოფა — პროფესიონალური აღჭურვილობა ოფიციალური გარანტიით და მიწოდებით საქართველოს მასშტაბით.";

/** intellcom უბრენდოს „Other“-ს უწერს — ეს ბრენდი არ არის, სათაურში არ უნდა მოხვდეს */
export const realBrand = (b: { name: string } | null | undefined) =>
  b && !/^(other|სხვა|no ?brand|-)$/i.test(b.name.trim()) ? b.name.trim() : null;

/** საკონტაქტო — .env-დან, რომ საიტი, ინვოისი და JSON-LD ერთსა და იმავეს წერდეს */
export const CONTACT = {
  phone: process.env.SELLER_PHONE || "",
  email: process.env.CONTACT_EMAIL || "sales@enex.ge",
  address: process.env.SELLER_ADDRESS || "თბილისი, საქართველო",
  hours: "ორშ–პარ: 10:00–18:00",
};

export const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);

/** 160 სიმბოლომდე, სიტყვის საზღვარზე */
export function clip(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

type ProductForSeo = {
  nameKa: string;
  nameEn?: string | null;
  nameRu?: string | null;
  sku: string;
  model: string | null;
  descriptionKa: string | null;
  descriptionEn?: string | null;
  descriptionRu?: string | null;
  price: number;
  stockStatus: string;
  slug: string;
  brand: { name: string } | null;
  category: { nameKa: string; slug: string; parent: { nameKa: string; slug: string } | null };
  images: { url: string }[];
  attributes?: { name: string; value: string }[];
};

/** აღწერა, თუ მიმწოდებელმა არ მოგვცა: სახელი, ბრენდი, მოდელი, მთავარი მახასიათებლები */
export function productDescription(p: ProductForSeo, locale: Locale = "ka"): string {
  const own = descriptionOf(p, locale);
  if (own) return clip(own);
  const t = (s: string, ...a: (string | number)[]) => translate(locale, s, ...a);
  const bits = [nameOf(p, locale)];
  const brand = realBrand(p.brand);
  if (brand) bits.push(t("ბრენდი: {0}", brand));
  if (p.model) bits.push(t("მოდელი: {0}", p.model));
  const specs = (p.attributes ?? [])
    .slice(0, 4)
    .map((a) => `${translateAttr(a.name, locale)}: ${translateAttr(a.value, locale)}`);
  if (specs.length) bits.push(specs.join(", "));
  bits.push(t("ოფიციალური გარანტია, მიწოდება საქართველოს მასშტაბით — Enex."));
  return clip(bits.join(". "));
}

const AVAILABILITY: Record<string, string> = {
  IN_STOCK: "https://schema.org/InStock",
  OUT_OF_STOCK: "https://schema.org/OutOfStock",
  IN_TRANSIT: "https://schema.org/BackOrder",
  PREORDER: "https://schema.org/PreOrder",
};

export function productJsonLd(p: ProductForSeo, locale: Locale = "ka") {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: nameOf(p, locale),
    sku: p.sku,
    ...(p.model ? { mpn: p.model } : {}),
    ...(realBrand(p.brand) ? { brand: { "@type": "Brand", name: realBrand(p.brand) } } : {}),
    description: productDescription(p, locale),
    image: p.images.map((i) => abs(i.url)),
    url: abs(`/product/${p.slug}`),
    offers: {
      "@type": "Offer",
      priceCurrency: "GEL",
      price: p.price.toFixed(2),
      availability: AVAILABILITY[p.stockStatus] ?? AVAILABILITY.OUT_OF_STOCK,
      url: abs(`/product/${p.slug}`),
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

/**
 * OnlineStore, არა Organization: სახელი „enex“ საკურიერო კომპანიებს ჰგავს და
 * საძიებო AI-ები ამანათების სერვისად თვლიდნენ — ტიპი და აღწერა ცალსახად ამბობს, რას ვყიდით.
 */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["OnlineStore", "Organization"],
    "@id": `${SITE_URL}/#store`,
    name: SITE_NAME,
    alternateName: "ენექსი",
    legalName: process.env.SELLER_NAME || undefined,
    description:
      "პროფესიონალური ელექტრონული აღჭურვილობის ონლაინ მაღაზია საქართველოში: ვიდეო-მეთვალყურეობის კამერები და ჩამწერები, ქსელური სვიჩები და როუტერები, UPS და მზის ენერგოსისტემები, სახანძრო სიგნალიზაცია, დაშვების კონტროლი. B2B და საცალო გაყიდვა, ოფიციალური გარანტია.",
    url: SITE_URL,
    logo: abs("/brand/enex-logo-1200.png"),
    image: abs("/brand/og.png"),
    areaServed: { "@type": "Country", name: "Georgia" },
    currenciesAccepted: "GEL",
    paymentAccepted: "Bank card, Bank transfer, Cash on pickup",
    knowsAbout: ["ვიდეო-მეთვალყურეობა", "IP კამერები", "ქსელური მოწყობილობები", "UPS", "მზის ინვერტორები", "სახანძრო სიგნალიზაცია", "დაშვების კონტროლი"],
    ...(CONTACT.phone ? { telephone: CONTACT.phone } : {}),
    email: CONTACT.email,
    ...(process.env.SELLER_ADDRESS
      ? { address: { "@type": "PostalAddress", streetAddress: process.env.SELLER_ADDRESS, addressCountry: "GE" } }
      : {}),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/catalog?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** JSON-LD სკრიპტის უსაფრთხო ჩასმა — „</script>“ ტექსტში რომ არ გაიხსნას */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/**
 * hreflang — გვერდის სამივე ენის ვერსია ერთმანეთზე მიბმული.
 * canonical მიმდინარე ენის მისამართია, languages კი სამივეს ჩამოთვლის.
 */
export function alts(path: string, locale: Locale) {
  return {
    canonical: withLocale(path, locale),
    languages: Object.fromEntries(LOCALES.map((l) => [l, withLocale(path, l)])),
  };
}
