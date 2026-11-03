import Link from "@/components/Link";
import { Suspense } from "react";
import BannerCarousel from "@/components/BannerCarousel";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { productCardSelect } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/customer-auth";
import { getI18n, getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import { alts } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * „ფასდაკლებული პროდუქტები“ — ყველა პროდუქტი, რომელსაც oldPrice აქვს.
 * ზემოთ — სარეკლამო ბანერების კარუსელი, ქვემოთ — ჩვეულებრივი ბარათები; ბანერი ჩანს მხოლოდ მაშინ, როცა მისი პროდუქტი
 * ჩართულია და ფასდაკლებაშია (თორემ ბანერის ფასი საიტისას აღარ დაემთხვევა).
 */
const BANNERS: { slug: string; image: string; title: string }[] = [
  { slug: "bluetti-premium-30-v2-portable-power-station-600w-320wh", image: "/brand/sale/bluetti-premium-30-v2.jpg", title: "Bluetti Premium 30 V2" },
  { slug: "infocus-interactive-display-d012-jtouch-13-75-in7513", image: "/brand/sale/infocus-jtouch-75.jpg", title: "InFocus JTouch 13 75\"" },
  { slug: "2-bay-arm-cortex-a55-quad-core-2-0-ghz-processor-2-gb-ram", image: "/brand/sale/qnap-ts-233.jpg", title: "QNAP TS-233" },
  { slug: "jabra-evolve-20-usb-c-a-ms-stereo", image: "/brand/sale/jabra-evolve-20.jpg", title: "Jabra Evolve 20" },
  { slug: "grandstream-gwn7630-wifi-access-point-802-11ac-wave-2", image: "/brand/sale/grandstream-gwn7630.jpg", title: "Grandstream GWN7630" },
  {
    slug: "lenovo-ideapad-slim-3-15-6-quot-fhd-non-touch-amd-ryzen-3-30-8gb-512gb-m-2-win-1",
    image: "/brand/sale/lenovo-ideapad-slim-3.jpg",
    title: "Lenovo IdeaPad Slim 3",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: translate(locale, "ფასდაკლებული პროდუქტები"),
    description: translate(locale, "ფასდაკლებული პროდუქტები ოფიციალური გარანტიით — Enex."),
    alternates: alts("/sale", locale),
  };
}

export default async function SalePage() {
  const { t } = await getI18n();
  const [products, viewer] = await Promise.all([
    db.product.findMany({
      where: { isActive: true, price: { gt: 0 }, oldPrice: { not: null } },
      select: productCardSelect,
      orderBy: { updatedAt: "desc" },
    }),
    getCurrentUser(),
  ]);
  const onSale = new Set(products.map((p) => p.slug));
  const banners = BANNERS.filter((b) => onSale.has(b.slug));

  return (
    <>
      <Suspense>
        <Header />
      </Suspense>
      <main className="container-x py-6">
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <Link href="/" className="hover:text-brand-600">{t("მთავარი")}</Link>
          <span>/</span>
          <span className="font-medium text-ink">{t("ფასდაკლებული პროდუქტები")}</span>
        </nav>
        <h1 className="mb-6 text-2xl font-bold">{t("ფასდაკლებული პროდუქტები")}</h1>

        <BannerCarousel banners={banners} />

        {products.length === 0 ? (
          <div className="card p-12 text-center text-muted">{t("ამჟამად ფასდაკლებული პროდუქტი არ არის.")}</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} p={p} viewer={viewer} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
