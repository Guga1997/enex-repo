import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import FilterSidebar from "@/components/FilterSidebar";
import SortSelect from "@/components/SortSelect";
import Pagination from "@/components/Pagination";
import { getCurrentUser } from "@/lib/customer-auth";
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!slug?.length) return { title: "კატალოგი" };
  const cat = await db.category.findUnique({ where: { slug: slug[slug.length - 1] } });
  return { title: cat?.nameKa ?? "კატალოგი" };
}

export default async function CatalogPage({ params, searchParams }: Props) {
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
          <Link href="/" className="hover:text-brand-600">მთავარი</Link>
          <span>/</span>
          {category?.parent && (
            <>
              <Link href={`/catalog/${category.parent.slug}`} className="hover:text-brand-600">
                {category.parent.nameKa}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="font-medium text-ink">
            {category?.nameKa ?? (query.q ? `ძებნა: ${query.q}` : "კატალოგი")}
          </span>
        </nav>

        <h1 className="mb-4 text-2xl font-bold">
          {category?.nameKa ?? (query.q ? `ძებნის შედეგები: ${query.q}` : "ყველა პროდუქტი")}
        </h1>

        {/* ქვეკატეგორიების ჩიპები */}
        {category && category.children.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {category.children.map((c) => (
              <Link
                key={c.id}
                href={`/catalog/${c.slug}`}
                className="rounded-full border border-line bg-white px-4 py-2 text-sm hover:border-brand-500 hover:text-brand-600"
              >
                {c.nameKa}
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
                ნაპოვნია <b className="text-ink">{total}</b> პროდუქტი
              </span>
              <Suspense>
                <SortSelect />
              </Suspense>
            </div>

            {items.length === 0 ? (
              <div className="card p-12 text-center">
                <p className="text-muted">
                  მითითებული ფილტრით პროდუქტი ვერ მოიძებნა.
                </p>
                <Link href="/catalog" className="btn btn-outline mt-4">
                  ფილტრის გასუფთავება
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
