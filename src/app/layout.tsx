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
    default: "Enex — პროფესიონალური აღჭურვილობა",
    template: "%s | Enex",
  },
  description: "ვიდეო-მეთვალყურეობა, ქსელური მოწყობილობები, ენერგო უზრუნველყოფა — ოფიციალური გარანტიით.",
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
