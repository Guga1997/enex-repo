import Link from "@/components/Link";
import Image from "next/image";
import { db } from "@/lib/db";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import HeroSlider from "@/components/HeroSlider";
import CategoryIcon from "@/components/CategoryIcon";
import { segmentTheme } from "@/lib/segment-theme";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { productCardSelect } from "@/lib/catalog";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/dict";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const t = await getT();
  const [banners, categories, discounted] = await Promise.all([
    db.banner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, subtitle: true, image: true, href: true },
    }),
    db.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.product.findMany({
      where: { isActive: true, oldPrice: { not: null } },
      select: productCardSelect,
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <Header />
      <main className="container-x py-8">
        <h1 className="sr-only">{t("Enex — პროფესიონალური აღჭურვილობის ონლაინ მაღაზია")}</h1>
        {/* ბანერები ადმინიდან იმართება; სანამ არცერთი არ არის — ზოგადი ბლოკი */}
        {banners.length > 0 ? (
          <HeroSlider slides={banners} />
        ) : (
        <section className="mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 px-8 py-14 text-white">
          <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
            {t("პროფესიონალური აღჭურვილობა — ერთ ადგილას")}
          </h1>
          <p className="mt-3 max-w-xl text-brand-100">
            ვიდეო-მეთვალყურეობა, ქსელური მოწყობილობები, ენერგო უზრუნველყოფა.
            ოფიციალური გარანტია და მიწოდება საქართველოს მასშტაბით.
          </p>
          <Link
            href="/catalog"
            className="btn mt-6 bg-white text-brand-700 hover:bg-brand-50"
          >
            {t("კატალოგის ნახვა")}
          </Link>
        </section>
        )}

        {categories.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-bold">{t("კატეგორიები")}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/catalog/${c.slug}`}
                  className="group card flex flex-col items-center gap-3 p-5 text-center transition hover:border-brand-200 hover:shadow-md"
                >
                  <div className="relative size-14">
                    {c.image ? (
                      <Image src={c.image} alt={c.nameKa} fill className="object-contain" />
                    ) : (
                      <div
                        className={`flex size-14 items-center justify-center rounded-full ${segmentTheme(c.nameKa, c.slug).tint} ${segmentTheme(c.nameKa, c.slug).ink}`}
                      >
                        <CategoryIcon name={c.nameKa} slug={c.slug} className="size-7" />
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-medium leading-tight">{c.nameKa}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <ProductRow t={t} title={t("ფასდაკლებები")} href="/catalog?discount=1" products={discounted} />

        {/* რა საიტია — ადამიანისთვისაც და საძიებო სისტემისთვისაც; სახელი საკურიერო კომპანიას ჰგავს */}
        <section className="mt-12 rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h2 className="text-lg font-bold">{t("Enex — პროფესიონალური აღჭურვილობის ონლაინ მაღაზია")}</h2>
          <div className="mt-3 grid gap-4 text-sm leading-relaxed text-muted sm:grid-cols-2">
            <p>
              ვყიდით ტექნიკას, რომლითაც ობიექტები, ოფისები და ქსელები იგება: ვიდეო-მეთვალყურეობის
              IP და ანალოგური კამერები, ჩამწერები, სახანძრო სიგნალიზაცია და დაშვების კონტროლი;
              ქსელური სვიჩები, როუტერები, WiFi და ოპტიკური აღჭურვილობა; UPS-ები, მზის ინვერტორები
              და ენერგო უზრუნველყოფა.
            </p>
            <p>
              ვმუშაობთ როგორც ინსტალატორებთან და კომპანიებთან სადილერო ფასებით, ისე საცალო
              მყიდველთან. ყველა პროდუქტი ოფიციალური გარანტიითაა, ნაშთი მიმწოდებლებთან
              რეალურ დროში სინქრონდება, მიწოდება — საქართველოს მასშტაბით, გატანა — თბილისში.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function ProductRow({
  t,
  title,
  href,
  products,
}: {
  t: T;
  title: string;
  href: string;
  products: React.ComponentProps<typeof ProductCard>["p"][];
}) {
  if (!products.length) return null;
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        <Link href={href} className="text-sm font-medium text-brand-600 hover:underline">
          {t("ყველას ნახვა →")}
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}
