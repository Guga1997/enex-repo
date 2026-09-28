import type { Metadata } from "next";
import StockApp from "@/components/stock/StockApp";
import { PC_CATEGORIES } from "@/lib/pc-build/specs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "საწყობი — კომპიუტერის კომპონენტები",
  description: "კომპიუტერის კომპონენტების საწყობის მართვა: ნაშთი, ფასი, ახალი პოზიცია.",
  robots: { index: false, follow: false },
  manifest: "/stock-manifest.webmanifest",
  appleWebApp: { capable: true, title: "Enex საწყობი", statusBarStyle: "black-translucent" },
};

/**
 * საწყობის აპლიკაცია — ცალკე კომპიუტერის კომპონენტებისთვის.
 *
 * ბრაუზერშიც იხსნება და ტელეფონზეც იდგმება (PWA). მონაცემებს მხოლოდ
 * API გასაღებით ეხება, ადმინის სესია არ სჭირდება — ამიტომ APK-ში შეფუთვისას
 * (TWA) ავტორიზაცია არ იკარგება. მხოლოდ PC კატეგორიებს ხედავს.
 */
export default function StockPage() {
  return (
    <StockApp
      categories={PC_CATEGORIES.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.nameKa,
        fields: c.fields,
      }))}
    />
  );
}
