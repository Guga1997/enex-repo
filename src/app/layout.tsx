import type { Metadata } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import ChatWidget from "@/components/ChatWidget";
import { getLocale } from "@/lib/i18n/server";
import { HTML_LANG, OG_LOCALE } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dict";
import { DEFAULT_DESCRIPTION, SITE_URL } from "@/lib/seo";

/**
 * ქართული ტექსტისთვის სისტემური ფონტი არ ვარგა — ასოების სისქე და
 * ინტერვალები არათანაბარია. Noto Sans Georgian ორივე დამწერლობას ფარავს,
 * ამიტომ ლათინურისთვის ცალკე ფონტი აღარ გვჭირდება.
 */
const georgian = Noto_Sans_Georgian({
  subsets: ["georgian", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-georgian",
});

const META: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Enex — პროფესიონალური აღჭურვილობა",
    template: "%s | Enex",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: "Enex",
  openGraph: {
    type: "website",
    siteName: "Enex",
    locale: "ka_GE",
    images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "Enex" }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

/**
 * რეჟიმის კლასი ხატვამდე უნდა დაჯდეს, თორემ გვერდი ჯერ თეთრად აციმციმდება.
 * ამიტომ პატარა სკრიპტი <head>-ში, ყველაფერზე ადრე.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

/**
 * ნახვების სტატისტიკა — Umami, ჩვენსავე სერვერზე (enex.ge/stats). cookie-ებს არ წერს,
 * IP-ს არ ინახავს. მხოლოდ enex.ge-ზე ითვლის (ლოკალური dev არა); ადმინის გვერდებს არ ითვლის.
 */
const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? "470ef852-3147-4e2f-81bf-43a7bb3d5c7e";
const UMAMI_FILTER = `window.enexStats=function(type,p){return p&&p.url&&/^\\/(admin|stats)(\\/|$)/.test(new URL(p.url,location.origin).pathname)?false:p}`;


/** სათაური და აღწერა მიმდინარე ენაზე */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = (s: string) => translate(locale, s);
  return {
    ...META,
    title: { default: t("Enex — პროფესიონალური აღჭურვილობა"), template: "%s | Enex" },
    description: t(DEFAULT_DESCRIPTION),
    openGraph: { ...META.openGraph, locale: OG_LOCALE[locale] },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={HTML_LANG[locale]} className={georgian.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: UMAMI_FILTER }} />
        <script
          defer
          src="/stats/t.js"
          data-website-id={UMAMI_WEBSITE_ID}
          data-domains="enex.ge"
          data-before-send="enexStats"
        />
      </head>
      <body>
        <LocaleProvider locale={locale}>
          <CartProvider>{children}</CartProvider>
          {/* AI კონსულტანტი: თვითონ წყვეტს, ჩანს თუ არა (ადმინში — არა; გათიშული — არა) */}
          <ChatWidget />
        </LocaleProvider>
      </body>
    </html>
  );
}
