import Link from "@/components/Link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/customer-auth";
import { productCardSelect } from "@/lib/catalog";
import ProductCard from "@/components/ProductCard";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "ჩემი ფავორიტები" };

export default async function FavoritesPage() {
  const t = await getT();
  const user = (await getCurrentUser())!;
  const favorites = await db.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { product: { select: productCardSelect } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t("ჩემი ფავორიტები")}</h1>

      {favorites.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-muted">{t("ფავორიტებში ჯერ არაფერია.")}</p>
          <Link href="/catalog" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
            {t("კატალოგში გადასვლა")}
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
