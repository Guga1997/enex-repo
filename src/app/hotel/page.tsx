import type { Metadata } from "next";
import Link from "@/components/Link";
import Image from "next/image";
import ProductPlaceholder from "@/components/ProductPlaceholder";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { gel, formatDate } from "@/lib/format";
import { getRate } from "@/lib/fx";
import { getCurrentUser } from "@/lib/customer-auth";
import { effectivePrice } from "@/lib/pricing";
import { JsonLd, breadcrumbJsonLd, clip } from "@/lib/seo";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const ROOT = "სასტუმროს სისტემები";

export const metadata: Metadata = {
  title: "სასტუმროს სისტემები — ელექტრონული საკეტები, სეიფები, მინიბარები",
  description: clip(
    "Omnitec Systems: სასტუმროს ელექტრონული საკეტები (OS Slim, EVO, Gaudi 3), დაშვების კონტროლი, სეიფები, მინიბარები, ენერგოსეივერები, ლოკერები და მართვის პროგრამა. ფასი ლარში ეროვნული ბანკის დღიური კურსით, მიწოდება შეკვეთით — Enex."
  ),
  alternates: { canonical: "/hotel" },
};

const serieOf = (p: { attributes: { name: string; value: string }[] }) =>
  p.attributes.find((x) => x.name === "სერია")?.value ?? "";
const leadOf = (p: { attributes: { name: string; value: string }[] }) =>
  p.attributes.find((x) => x.name === "მიწოდების ვადა")?.value ?? "";

export default async function HotelPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const t = await getT();
  const { group } = await searchParams;
  const root = await db.category.findFirst({
    where: { nameKa: ROOT },
    include: { children: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
  const groups = root?.children ?? [];
  const active = groups.find((c) => c.slug === group) ?? null;

  const [products, viewer, fx] = await Promise.all([
    db.product.findMany({
      where: {
        isActive: true,
        categoryId: active ? active.id : { in: groups.map((c) => c.id) },
      },
      include: {
        category: { select: { nameKa: true, slug: true } },
        attributes: { orderBy: { sortOrder: "asc" } },
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    }),
    getCurrentUser(),
    getRate("EUR").catch(() => null),
  ]);
  const rows = products
    .map((p) => ({ p, price: effectivePrice(p, viewer) }))
    .sort(
      (a, b) =>
        a.p.category.nameKa.localeCompare(b.p.category.nameKa, "ka") ||
        serieOf(a.p).localeCompare(serieOf(b.p)) ||
        a.price.value - b.price.value
    );

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "მთავარი", path: "/" }, { name: ROOT, path: "/hotel" }])} />
      <Suspense>
        <Header />
      </Suspense>

      <main className="container-x py-6">
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <Link href="/" className="hover:text-brand-600">{t("მთავარი")}</Link>
          <span>/</span>
          <span className="text-ink">{ROOT}</span>
        </nav>

        <section className="mb-6 rounded-2xl bg-gradient-to-br from-nav to-brand-700 px-6 py-8 text-white sm:px-10 sm:py-10">
          <h1 className="text-2xl font-bold sm:text-3xl">{t("სასტუმროს სისტემები")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/80 sm:text-base">
            <b className="text-white">Omnitec Systems</b> — ესპანური ბრენდი, 10 000-ზე მეტ სასტუმროში
            მსოფლიოს 5 კონტინენტზე: ელექტრონული საკეტები, დაშვების კონტროლი, სეიფები, მინიბარები,
            ენერგოსეივერები, ლოკერები და მართვის პროგრამა. ყველა პოზიცია{" "}
            <b className="text-white">{t("შეკვეთით")}</b> მოდის; ობიექტის კონფიგურაცია და მონტაჟი — ჩვენი გუნდით.
          </p>
          {fx && (
            <p className="mt-4 text-xs text-white/60">
              ფასები ლარში, ეროვნული ბანკის კურსით: 1 EUR = {fx.rate.toFixed(4)} ₾
              {fx.validFrom ? ` (${formatDate(fx.validFrom)})` : ""} — ყოველდღიურად ახლდება.
            </p>
          )}
        </section>

        {/* ძრავის არჩევა */}
        <div className="mb-5 flex flex-wrap gap-2">
          <Link
            href="/hotel"
            className={`rounded-full border px-4 py-2 text-sm ${!active ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-surface hover:border-brand-500"}`}
          >
            ყველა ({products.length})
          </Link>
          {groups.map((c) => (
            <Link
              key={c.id}
              href={`/hotel?group=${c.slug}`}
              className={`rounded-full border px-4 py-2 text-sm ${active?.id === c.id ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-surface hover:border-brand-500"}`}
            >
              {c.nameKa}
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="card p-8 text-center text-muted">{t("ამ ჯგუფში პოზიციები ჯერ არ არის გამოქვეყნებული.")}</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas text-left text-xs text-muted">
                <tr>
                  <th className="p-3 font-medium" colSpan={2}>{t("დასახელება")}</th>
                  <th className="p-3 font-medium">{t("ჯგუფი")}</th>
                  <th className="p-3 font-medium">{t("კოდი")}</th>
                  <th className="p-3 text-right font-medium">{t("ფასი")}</th>
                  <th className="p-3 font-medium">{t("მიწოდება")}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ p, price }) => (
                  <tr key={p.id} className="hover:bg-canvas/60">
                    <td className="w-16 p-2">
                      <Link href={`/product/${p.slug}`} className="block size-12 overflow-hidden rounded">
                        {p.images[0] ? (
                          <Image
                            src={p.images[0].url}
                            alt=""
                            width={48}
                            height={48}
                            className="size-12 object-contain"
                          />
                        ) : (
                          <ProductPlaceholder category={p.category.nameKa} />
                        )}
                      </Link>
                    </td>
                    <td className="p-3">
                      <Link href={`/product/${p.slug}`} className="font-medium hover:text-brand-600">
                        {p.nameKa.split(" — ").slice(1).join(" — ") || p.nameKa}
                      </Link>
                    </td>
                    <td className="p-3 text-muted">{p.category.nameKa}</td>
                    <td className="p-3 font-mono text-xs text-muted">{p.sku}</td>
                    <td className="p-3 text-right">
                      <div className="font-bold tabular-nums">{gel(price.value)}</div>
                      {price.saved > 0 && <div className="text-xs text-emerald-700">{t("სადილერო ფასი")}</div>}
                    </td>
                    <td className="p-3 text-muted">{leadOf(p) || "შეკვეთით"}</td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/product/${p.slug}`}
                        className="inline-block rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
                      >
                        {t("შეკვეთა")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-6 text-sm text-muted">
          ფასები ერთეულზეა. კომპლექტაცია (მექანიზმი, ფირფიტები, ბარათები, პროგრამა) ობიექტის მიხედვით
          ირჩევა — მოგვწერეთ ნომრების რაოდენობა და მოგიმზადებთ შეთავაზებას მონტაჟით.
        </p>
      </main>
      <Footer />
    </>
  );
}
