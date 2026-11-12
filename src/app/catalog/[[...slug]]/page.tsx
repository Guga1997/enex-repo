import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCategoryTree } from "@/lib/category-tree";
import { CABLES_SLUG, cableCategoryIds, cableGroups, cablesSegment } from "@/lib/cables";
import { JsonLd, breadcrumbJsonLd, clip, alts } from "@/lib/seo";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import FilterSidebar from "@/components/FilterSidebar";
import { attrLabels } from "@/lib/i18n/attributes";
import SortSelect from "@/components/SortSelect";
import Pagination from "@/components/Pagination";
import { getCurrentUser } from "@/lib/customer-auth";
import { getI18n } from "@/lib/i18n/server";
import { nameOf } from "@/lib/i18n/content";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/dict";
import {
  categoryIdsWithDescendants,
  getFacetsCached,
  getProducts,
  fixTypos,
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
  // სარეკლამო პარამეტრები (utm_*, fbclid…) ფილტრი არ არის — გვერდი ინდექსში რჩება
  const filtered = Object.keys(sp).some((k) => !/^(utm_|fbclid$|gclid$|yclid$|_ga$)/.test(k));
  const base = slug?.length ? `/catalog/${slug[slug.length - 1]}` : "/catalog";
  const robots = filtered ? { index: false, follow: true } : undefined;

  if (slug?.[slug.length - 1] === CABLES_SLUG) {
    const groups = cableGroups((await getCategoryTree()).roots);
    return {
      title: translate(locale, "კაბელები"),
      description: clip(
        `${translate(locale, "კაბელები")}: ${groups.map((g) => nameOf(g, locale)).join(", ")}. ${translate(
          locale,
          "პროფესიონალური აღჭურვილობა ოფიციალური გარანტიით, მიწოდება საქართველოს მასშტაბით — Enex."
        )}`
      ),
      alternates: alts(base, locale),
      robots,
    };
  }
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
    `${nameOf(cat, locale)}${cat.parent ? " — " + nameOf(cat.parent, locale) : ""}: ${subs ? subs + ". " : ""}${
      count
        ? translate(locale, "{0} პროდუქტი ოფიციალური გარანტიით, მიწოდება საქართველოს მასშტაბით — Enex.", count)
        : translate(locale, "პროფესიონალური აღჭურვილობა ოფიციალური გარანტიით, მიწოდება საქართველოს მასშტაბით — Enex.")
    }`
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
  const tree = await getCategoryTree();
  // „კაბელები“ — ვირტუალური სეგმენტი: საკუთარი კატეგორია არ აქვს, ოთხი შტოს კაბელებს აერთიანებს
  const cables = slug?.[slug.length - 1] === CABLES_SLUG ? cablesSegment(tree.roots) : null;

  if (cables) {
    categoryIds = cableCategoryIds(tree.roots);
  } else if (slug?.length) {
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
  // ქვეკატეგორიების ჩიპები: სავსე წინ, ცარიელი ბოლოს — იგივე რიგი, რაც მენიუში
  const chips = cables ? cables.children : category ? (tree.byId.get(category.id)?.children ?? []) : [];
  const heading = cables ? nameOf(cables, locale) : category ? nameOf(category, locale) : null;

  const viewer = await getCurrentUser();
  const asked = parseQuery(sp, categoryIds);
  // „hikvison“ → „hikvision“: ნული შედეგის ნაცვლად ყველაზე ახლო ბრენდი/კატეგორია
  const query = await fixTypos(asked);
  const [facets, { items, total, pages }] = await Promise.all([
    getFacetsCached(query),
    getProducts(query),
  ]);

  // Google-ისთვის იგივე ჯაჭვი, რაც გვერდზე ჩანს (ძებნის შედეგებზე — არა: ისინი ინდექსში არ მიდის)
  const crumbs = [
    { name: t("მთავარი"), path: "/" },
    ...(category?.parent ? [{ name: nameOf(category.parent, locale), path: `/catalog/${category.parent.slug}` }] : []),
    cables
      ? { name: nameOf(cables, locale), path: `/catalog/${CABLES_SLUG}` }
      : category
        ? { name: nameOf(category, locale), path: `/catalog/${category.slug}` }
        : { name: t("კატალოგი"), path: "/catalog" },
  ];

  return (
    <>
      {!query.q && <JsonLd data={breadcrumbJsonLd(crumbs, locale)} />}
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
            {heading ?? (query.q ? t("ძებნა: {0}", query.q) : t("კატალოგი"))}
          </span>
        </nav>

        <h1 className="mb-4 text-2xl font-bold">
          {heading ?? (query.q ? t("ძებნის შედეგები: {0}", query.q) : t("ყველა პროდუქტი"))}
        </h1>
        {asked.q && query.q !== asked.q && (
          <p className="-mt-2 mb-4 text-sm text-muted">
            {t("„{0}“ ვერ მოიძებნა — ნაჩვენებია „{1}“.", asked.q, query.q ?? "")}
          </p>
        )}

        {/* ქვეკატეგორიების ჩიპები */}
        {chips.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {chips.map((c) => (
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
            <FilterSidebar
              facets={facets}
              labels={attrLabels(
                facets.attributes.flatMap((a) => [a.name, ...a.values.flatMap((v) => [v.value, ...(v.members ?? [])])]),
                locale
              )}
            />
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
