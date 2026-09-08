import type { Metadata } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";

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
  title: {
    default: "ონლაინ მაღაზია",
    template: "%s | ონლაინ მაღაზია",
  },
  description: "პროფესიონალური აღჭურვილობის ონლაინ მაღაზია",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka" className={georgian.variable}>
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
