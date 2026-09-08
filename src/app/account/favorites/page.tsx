import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/customer-auth";
import { productCardSelect } from "@/lib/catalog";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "ჩემი ფავორიტები" };

export default async function FavoritesPage() {
  const user = (await getCurrentUser())!;
  const favorites = await db.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { product: { select: productCardSelect } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">ჩემი ფავორიტები</h1>

      {favorites.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-muted">ფავორიტებში ჯერ არაფერია.</p>
          <Link href="/catalog" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
            კატალოგში გადასვლა
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {favorites.map((f) => (
            <ProductCard key={f.id} p={f.product} viewer={user} />
          ))}
        </div>
      )}
    </div>
  );
}
