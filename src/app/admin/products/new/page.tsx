import { db } from "@/lib/db";
import ProductForm from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "ახალი პროდუქტი" };

export default async function NewProductPage() {
  const [categories, brands] = await Promise.all([
    db.category.findMany({
      select: { id: true, nameKa: true, parentId: true },
      orderBy: { nameKa: "asc" },
    }),
    db.brand.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  return <ProductForm categories={categories} brandNames={brands.map((b) => b.name)} />;
}
