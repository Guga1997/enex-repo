import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { JsonLd, breadcrumbJsonLd, productDescription, productJsonLd, realBrand } from "@/lib/seo";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import FavoriteButton from "@/components/FavoriteButton";
import { getCurrentUser } from "@/lib/customer-auth";
import { effectivePrice } from "@/lib/pricing";
import AddToCart from "@/components/AddToCart";
import Gallery from "@/components/Gallery";
import { gel } from "@/lib/format";
import { isPurchasable, stockLabel } from "@/lib/stock";
import { productCardSelect } from "@/lib/catalog";
import { StockStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await db.product.findUnique({
    where: { slug },
    include: {
      brand: true,
      category: { include: { parent: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      attributes: { orderBy: { sortOrder: "asc" }, take: 4 },
    },
  });
  if (!p || !p.isActive) return { title: "პროდუქტი ვერ მოიძებნა", robots: { index: false } };

  // სათაურში ბრენდი და მოდელი — ამით ეძებენ; სახელი ისედაც აღწერითია
  const title = [p.nameKa, realBrand(p.brand), p.model].filter(Boolean).join(" — ");
  const description = productDescription(p);
  return {
    title,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/product/${p.slug}`,
      images: p.images[0] ? [{ url: p.images[0].url, alt: p.nameKa }] : undefined,
    },
  };
}

const TONE = {
  ok: "bg-emerald-50 text-emerald-700",
  low: "bg-amber-50 text-amber-700",
  transit: "bg-sky-50 text-sky-700",
  none: "bg-slate-100 text-muted",
} as const;

const DOC_KIND: Record<string, string> = {
  DATASHEET: "ტექნიკური დოკუმენტაცია",
  CERTIFICATE: "სერტიფიკატი",
  MANUAL: "ინსტრუქცია",
};

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;

  const p = await db.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      attributes: { orderBy: { sortOrder: "asc" } },
      documents: { orderBy: { sortOrder: "asc" } },
      brand: true,
      category: { include: { parent: true } },
    },
  });
  if (!p || !p.isActive) notFound();

  const related = await db.product.findMany({
    where: { categoryId: p.categoryId, isActive: true, id: { not: p.id } },
    select: productCardSelect,
    take: 4,
  });

  const viewer = await getCurrentUser();
  const price = effectivePrice(p, viewer);
  const isFavorite = viewer
    ? Boolean(await db.favorite.findUnique({
        where: { userId_productId: { userId: viewer.id, productId: p.id } },
      }))
    : false;

  const stock = stockLabel(p);
  const canBuy = isPurchasable(p);
  const discount =
    p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : null;

  const crumbs = [
    { name: "მთავარი", path: "/" },
    ...(p.category.parent ? [{ name: p.category.parent.nameKa, path: `/catalog/${p.category.parent.slug}` }] : []),
    { name: p.category.nameKa, path: `/catalog/${p.category.slug}` },
    { name: p.nameKa, path: `/product/${p.slug}` },
  ];

  return (
    <>
      <JsonLd data={productJsonLd(p)} />
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Suspense>
        <Header />
      </Suspense>

      <main className="container-x py-6">
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <Link href="/" className="hover:text-brand-600">მთავარი</Link>
          <span>/</span>
          {p.category.parent && (
            <>
              <Link href={`/catalog/${p.category.parent.slug}`} className="hover:text-brand-600">
                {p.category.parent.nameKa}
              </Link>
              <span>/</span>
            </>
          )}
          <Link href={`/catalog/${p.category.slug}`} className="hover:text-brand-600">
            {p.category.nameKa}
          </Link>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2">
          <Gallery images={p.images.map((i) => ({ url: i.url, alt: i.alt ?? p.nameKa }))} />

          <div>
            <h1 className="text-2xl font-bold leading-snug">{p.nameKa}</h1>

            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {p.model && (
                <>
                  <dt className="text-muted">მოდელი</dt>
                  <dd className="font-medium">{p.model}</dd>
                </>
              )}
              <dt className="text-muted">კოდი</dt>
              <dd className="font-medium">#{p.sku}</dd>
              {p.brand && (
                <>
                  <dt className="text-muted">ბრენდი</dt>
                  <dd>
                    <Link
                      href={`/catalog?brand=${p.brand.slug}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {p.brand.name}
                    </Link>
                  </dd>
                </>
              )}
            </dl>

            <div className="card mt-6 p-5">
              {price.saved > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-3">
                    <span className="text-sm text-muted">
                      {price.isDealer ? "სადილერო:" : "თქვენი ფასი:"}
                    </span>
                    <span className="text-3xl font-bold text-brand-600">{gel(price.value)}</span>
                    <span className="rounded bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">
                      -{Math.round(price.savedPercent)}%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3 text-sm text-muted">
                    <span>საცალო:</span>
                    <span className="line-through">{gel(price.retail)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold">{gel(price.value)}</span>
                  {p.oldPrice && p.oldPrice > p.price && (
                    <>
                      <span className="text-lg text-muted line-through">{gel(p.oldPrice)}</span>
                      <span className="rounded bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">
                        -{discount}%
                      </span>
                    </>
                  )}
                </div>
              )}

              {!viewer && (
                <p className="mt-2 text-sm text-muted">
                  <Link href="/register" className="font-medium text-brand-600 hover:underline">
                    დარეგისტრირდი
                  </Link>{" "}
                  და შენს ფასს დაინახავ.
                </p>
              )}

              <div className={`mt-3 inline-block rounded-lg px-3 py-1.5 text-sm font-medium ${TONE[stock.tone]}`}>
                {stock.text}
              </div>

              <div className="mt-5 flex items-center gap-2">
                <FavoriteButton productId={p.id} initial={isFavorite} signedIn={Boolean(viewer)} />
              </div>

              <div className="mt-3">
                <AddToCart
                  withQty
                  disabled={!canBuy}
                  line={{
                    productId: p.id,
                    sku: p.sku,
                    name: p.nameKa,
                    slug: p.slug,
                    price: price.value,
                    image: p.images[0]?.url,
                    maxQty: p.stockStatus === StockStatus.IN_STOCK ? p.stockQty : 0,
                  }}
                />
              </div>

              <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-muted">
                <li>✓ ოფიციალური გარანტია</li>
                <li>✓ მიწოდება საქართველოს მასშტაბით</li>
                <li>✓ გადახდა ბარათით ან განვადებით</li>
              </ul>
            </div>
          </div>
        </div>

        {(p.descriptionKa || p.attributes.length > 0) && (
          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            {p.descriptionKa && (
              <section>
                <h2 className="mb-3 text-lg font-bold">აღწერა</h2>
                <div className="card whitespace-pre-line p-5 text-sm leading-relaxed text-ink">
                  {p.descriptionKa}
                </div>
              </section>
            )}
            {p.attributes.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold">მახასიათებლები</h2>
                <table className="card w-full overflow-hidden text-sm">
                  <tbody>
                    {p.attributes.map((a, i) => (
                      <tr key={a.id} className={i % 2 ? "bg-canvas" : ""}>
                        <td className="w-1/2 px-4 py-2.5 text-muted">{a.name}</td>
                        <td className="px-4 py-2.5 font-medium">{a.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        )}

        {p.documents.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-3 text-lg font-bold">დოკუმენტაცია</h2>
            <div className="card divide-y divide-line">
              {p.documents.map((d) => (
                <a
                  key={d.id}
                  href={d.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-canvas"
                >
                  <span className="font-medium text-brand-600">{d.title}</span>
                  <span className="text-muted">
                    {DOC_KIND[d.kind] ?? d.kind}
                    {d.sizeBytes ? " · " + Math.round(d.sizeBytes / 1024) + " KB" : ""}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-bold">მსგავსი პროდუქტები</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {related.map((r) => (
                <ProductCard key={r.id} p={r} viewer={viewer} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
