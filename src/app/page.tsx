import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import HeroSlider from "@/components/HeroSlider";
import { productCardSelect } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [banners, categories, newest, discounted] = await Promise.all([
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
      where: { isActive: true },
      select: productCardSelect,
      orderBy: { createdAt: "desc" },
      take: 8,
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
      <Header />
      <main className="container-x py-8">
        {/* ბანერები ადმინიდან იმართება; სანამ არცერთი არ არის — ზოგადი ბლოკი */}
        {banners.length > 0 ? (
          <HeroSlider slides={banners} />
        ) : (
        <section className="mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 px-8 py-14 text-white">
          <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
            პროფესიონალური აღჭურვილობა — ერთ ადგილას
          </h1>
          <p className="mt-3 max-w-xl text-brand-100">
            ვიდეო-მეთვალყურეობა, ქსელური მოწყობილობები, ენერგო უზრუნველყოფა.
            ოფიციალური გარანტია და მიწოდება საქართველოს მასშტაბით.
          </p>
          <Link
            href="/catalog"
            className="btn mt-6 bg-white text-brand-700 hover:bg-brand-50"
          >
            კატალოგის ნახვა
          </Link>
        </section>
        )}

        {categories.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-bold">კატეგორიები</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/catalog/${c.slug}`}
                  className="card flex flex-col items-center gap-3 p-5 text-center transition hover:border-brand-200 hover:shadow-md"
                >
                  <div className="relative size-14">
                    {c.image ? (
                      <Image src={c.image} alt={c.nameKa} fill className="object-contain" />
                    ) : (
                      <div className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-medium leading-tight">{c.nameKa}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <ProductRow title="ახალი პროდუქტები" href="/catalog?sort=newest" products={newest} />
        <ProductRow title="ფასდაკლებები" href="/catalog?discount=1" products={discounted} />
      </main>
      <Footer />
    </>
  );
}

function ProductRow({
  title,
  href,
  products,
}: {
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
          ყველას ნახვა →
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
