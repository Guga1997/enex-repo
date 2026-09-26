import type { Metadata } from "next";
import Link from "@/components/Link";
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

const ROOT = "დიზელის გენერატორები";

export const metadata: Metadata = {
  title: "დიზელის გენერატორები 15–2000 kVA — Baudouin, IVECO, Perkins, Scania",
  description: clip(
    "ZEN დიზელ-გენერატორები Baudouin, IVECO, Perkins და Scania ძრავებით, 15-დან 2000 kVA-მდე. ფასი ლარში ეროვნული ბანკის დღიური კურსით, ტექნიკური დოკუმენტაცია ყველა მოდელზე, მიწოდება შეკვეთით — Enex."
  ),
  alternates: { canonical: "/generators" },
};

/** kVA სახელიდან ან მახასიათებლიდან — დალაგებისთვის */
const kvaOf = (p: { attributes: { name: string; value: string }[]; nameKa: string }) => {
  const a = p.attributes.find((x) => /stand-by|kva/i.test(x.name))?.value ?? p.nameKa;
  return Number(a.match(/(\d+(?:\.\d+)?)\s*kVA/i)?.[1] ?? a.match(/(\d+)/)?.[1] ?? 0);
};

export default async function GeneratorsPage({
  searchParams,
}: {
  searchParams: Promise<{ engine?: string }>;
}) {
  const t = await getT();
  const { engine } = await searchParams;
  const root = await db.category.findFirst({
    where: { nameKa: ROOT },
    include: { children: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
  const engines = root?.children ?? [];
  const active = engines.find((c) => c.slug === engine) ?? null;

  const [products, viewer, fx] = await Promise.all([
    db.product.findMany({
      where: {
        isActive: true,
        categoryId: active ? active.id : { in: engines.map((c) => c.id) },
      },
      include: {
        category: { select: { nameKa: true, slug: true } },
        attributes: { orderBy: { sortOrder: "asc" } },
        documents: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    }),
    getCurrentUser(),
    getRate("EUR").catch(() => null),
  ]);
  const rows = products
    .map((p) => ({ p, kva: kvaOf(p), price: effectivePrice(p, viewer) }))
    .sort((a, b) => a.kva - b.kva || a.p.category.nameKa.localeCompare(b.p.category.nameKa));

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "მთავარი", path: "/" }, { name: ROOT, path: "/generators" }])} />
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
          <h1 className="text-2xl font-bold sm:text-3xl">{t("დიზელის გენერატორები")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/80 sm:text-base">
            ZEN სერიის სადგურები Baudouin, IVECO, Perkins და Scania ძრავებით — 15-დან 2000 kVA-მდე.
            ყველა მოდელი <b className="text-white">{t("შეკვეთით")}</b> მოდის; თითოეულს თან ახლავს ქარხნული
            ტექნიკური დოკუმენტაცია. კონფიგურაცია (ავტომატიკა ATS, ხმაურდამცავი კორპუსი, ტრეილერი)
            მოთხოვნით.
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
            href="/generators"
            className={`rounded-full border px-4 py-2 text-sm ${!active ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-surface hover:border-brand-500"}`}
          >
            ყველა ({products.length})
          </Link>
          {engines.map((c) => (
            <Link
              key={c.id}
              href={`/generators?engine=${c.slug}`}
              className={`rounded-full border px-4 py-2 text-sm ${active?.id === c.id ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-surface hover:border-brand-500"}`}
            >
              {c.nameKa}
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="card p-8 text-center text-muted">{t("ამ ჯგუფში გენერატორები ჯერ არ არის გამოქვეყნებული.")}</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas text-left text-xs text-muted">
                <tr>
                  <th className="p-3 font-medium">{t("მოდელი")}</th>
                  <th className="p-3 text-right font-medium">Stand-by, kVA</th>
                  <th className="p-3 font-medium">{t("ძრავი")}</th>
                  <th className="p-3 text-right font-medium">{t("ფასი")}</th>
                  <th className="p-3 font-medium">{t("დოკუმენტაცია")}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ p, kva, price }) => (
                  <tr key={p.id} className="hover:bg-canvas/60">
                    <td className="p-3">
                      <Link href={`/product/${p.slug}`} className="font-semibold hover:text-brand-600">
                        {p.model ?? p.sku}
                      </Link>
                    </td>
                    <td className="p-3 text-right font-medium tabular-nums">{kva || "—"}</td>
                    <td className="p-3 text-muted">{p.category.nameKa.replace(" ძრავით", "")}</td>
                    <td className="p-3 text-right">
                      <div className="font-bold tabular-nums">{gel(price.value)}</div>
                      {price.saved > 0 && <div className="text-xs text-emerald-700">{t("სადილერო ფასი")}</div>}
                    </td>
                    <td className="p-3">
                      {p.documents[0] ? (
                        <a href={p.documents[0].url} target="_blank" rel="noopener" className="text-brand-600 hover:underline">
                          PDF ↗
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
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
          სიმძლავრე მითითებულია Stand-by რეჟიმში (ISO 8528-1). Prime სიმძლავრე ≈ 10%-ით ნაკლები.
          მიწოდების ვადა და საბოლოო კონფიგურაცია შეკვეთისას დგინდება — დაგვიკავშირდით.
        </p>
      </main>
      <Footer />
    </>
  );
}
