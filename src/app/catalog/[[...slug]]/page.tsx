import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { clip, alts } from "@/lib/seo";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import FilterSidebar from "@/components/FilterSidebar";
import SortSelect from "@/components/SortSelect";
import Pagination from "@/components/Pagination";
import { getCurrentUser } from "@/lib/customer-auth";
import { getI18n } from "@/lib/i18n/server";
import { nameOf } from "@/lib/i18n/content";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import {
  categoryIdsWithDescendants,
  getFacets,
  getProducts,
  parseQuery,
  type SearchParams,
} from "@/lib/catalog";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = await getLocale();
  const { slug } = await params;
  const sp = await searchParams;
  // ფილტრიანი/დალაგებული/გვერდიანი ვარიანტები ერთი გვერდის ასლებია — კანონიკური ბაზისურია,
  // ინდექსში მხოლოდ ის მიდის
  const filtered = Object.keys(sp).length > 0;
  const base = slug?.length ? `/catalog/${slug[slug.length - 1]}` : "/catalog";
  const robots = filtered ? { index: false, follow: true } : undefined;

  if (!slug?.length) {
    return {
      title: translate(locale, "კატალოგი — ვიდეო-მეთვალყურეობა, ქსელი, ენერგო უზრუნველყოფა"),
      description: translate(locale, "სრული კატალოგი: IP კამერები, ჩამწერები, სვიჩები, როუტერები, UPS, მზის სისტემები და სხვა — ოფიციალური გარანტიით."),
      alternates: alts(base, locale),
      robots,
    };
  }
  const cat = await db.category.findUnique({
    where: { slug: slug[slug.length - 1] },
    include: {
      parent: true,
      children: { where: { isActive: true }, select: { nameKa: true, nameEn: true, nameRu: true }, take: 8 },
    },
  });
  if (!cat) return { title: translate(locale, "კატალოგი") };
  const count = await db.product.count({ where: { isActive: true, categoryId: cat.id } });
  const subs = cat.children.map((c) => nameOf(c, locale)).join(", ");
  const description = clip(
    `${nameOf(cat, locale)}${cat.parent ? " — " + nameOf(cat.parent, locale) : ""}: ${subs ? subs + ". " : ""}${count ? count + " პროდუქტი" : "პროფესიონალური აღჭურვილობა"} ოფიციალური გარანტიით, მიწოდება საქართველოს მასშტაბით — Enex.`
  );
  return {
    title: cat.parent ? `${nameOf(cat, locale)} — ${nameOf(cat.parent, locale)}` : nameOf(cat, locale),
    description,
    alternates: alts(base, locale),
    robots,
  };
}

export default async function CatalogPage({ params, searchParams }: Props) {
  const { locale, t } = await getI18n();
  const { slug } = await params;
  const sp = await searchParams;

  let category = null;
  let categoryIds: string[] = [];

  if (slug?.length) {
    category = await db.category.findUnique({
      where: { slug: slug[slug.length - 1] },
      include: {
        parent: true,
        children: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!category || !category.isActive) notFound();
    categoryIds = await categoryIdsWithDescendants(category.id);
  }

  const viewer = await getCurrentUser();
  const query = parseQuery(sp, categoryIds);
  const [facets, { items, total, pages }] = await Promise.all([
    getFacets(query),
    getProducts(query),
  ]);

  return (
    <>
      <Suspense>
        <Header />
      </Suspense>

      <main className="container-x py-6">
        {/* ნავიგაციის ჯაჭვი */}
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <Link href="/" className="hover:text-brand-600">{t("მთავარი")}</Link>
          <span>/</span>
          {category?.parent && (
            <>
              <Link href={`/catalog/${category.parent.slug}`} className="hover:text-brand-600">
                {nameOf(category.parent, locale)}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="font-medium text-ink">
            {(category ? nameOf(category, locale) : null) ?? (query.q ? `ძებნა: ${query.q}` : "კატალოგი")}
          </span>
        </nav>

        <h1 className="mb-4 text-2xl font-bold">
          {(category ? nameOf(category, locale) : null) ?? (query.q ? `ძებნის შედეგები: ${query.q}` : "ყველა პროდუქტი")}
        </h1>

        {/* ქვეკატეგორიების ჩიპები */}
        {category && category.children.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {category.children.map((c) => (
              <Link
                key={c.id}
                href={`/catalog/${c.slug}`}
                className="rounded-full border border-line bg-surface px-4 py-2 text-sm hover:border-brand-500 hover:text-brand-600"
              >
                {nameOf(c, locale)}
              </Link>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <Suspense fallback={<div className="card h-96 animate-pulse" />}>
            <FilterSidebar facets={facets} />
          </Suspense>

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted">
                {t("ნაპოვნია")} <b className="text-ink">{total}</b> {t("პროდუქტი")}
              </span>
              <Suspense>
                <SortSelect />
              </Suspense>
            </div>

            {items.length === 0 ? (
              <div className="card p-12 text-center">
                <p className="text-muted">
                  {t("მითითებული ფილტრით პროდუქტი ვერ მოიძებნა.")}
                </p>
                <Link href="/catalog" className="btn btn-outline mt-4">
                  {t("ფილტრის გასუფთავება")}
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {items.map((p) => (
                  <ProductCard key={p.id} p={p} viewer={viewer} />
                ))}
              </div>
            )}

            <Suspense>
              <Pagination page={query.page} pages={pages} />
            </Suspense>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
