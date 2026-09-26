import type { Metadata } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import { getLocale } from "@/lib/i18n/server";
import { HTML_LANG } from "@/lib/i18n/config";
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

export const metadata: Metadata = {
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={HTML_LANG[locale]} className={georgian.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <LocaleProvider locale={locale}>
          <CartProvider>{children}</CartProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
