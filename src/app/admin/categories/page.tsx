import { db } from "@/lib/db";
import { deleteCategory, saveCategory, toggleCategoryActive } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "კატეგორიები" };

export default async function AdminCategories() {
  const categories = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameKa: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  const roots = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">კატეგორიები</h1>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="card divide-y divide-line">
          {roots.map((root) => (
            <div key={root.id}>
              <Row category={root} depth={0} />
              {childrenOf(root.id).map((child) => (
                <Row key={child.id} category={child} depth={1} />
              ))}
            </div>
          ))}
          {roots.length === 0 && (
            <p className="p-10 text-center text-muted">კატეგორია ჯერ არ არის დამატებული.</p>
          )}
        </div>

        <form action={saveCategory} className="card h-fit space-y-4 p-5">
          <h2 className="font-semibold">ახალი კატეგორია</h2>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              დასახელება <span className="text-rose-500">*</span>
            </span>
            <input
              name="nameKa"
              required
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">დასახელება (ინგლისურად)</span>
            <input
              name="nameEn"
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">მშობელი კატეგორია</span>
            <select
              name="parentId"
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            >
              <option value="">— მთავარი კატეგორია —</option>
              {roots.map((c) => (
                <option key={c.id} value={c.id}>{c.nameKa}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">რიგითობა</span>
            <input
              name="sortOrder"
              type="number"
              defaultValue={0}
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" name="isActive" defaultChecked className="size-4 accent-brand-500" />
            აქტიური
          </label>

          <button className="btn btn-primary w-full hover:bg-brand-600">დამატება</button>
        </form>
      </div>
    </div>
  );
}

function Row({
  category,
  depth,
}: {
  category: {
    id: string;
    nameKa: string;
    slug: string;
    isActive: boolean;
    sortOrder: number;
    _count: { products: number };
  };
  depth: number;
}) {
  return (
    <div className={`flex items-center gap-3 p-4 ${depth ? "pl-10" : ""} ${category.isActive ? "" : "opacity-50"}`}>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{category.nameKa}</div>
        <div className="text-xs text-muted">
          /{category.slug} · {category._count.products} პროდუქტი
        </div>
      </div>

      <form action={toggleCategoryActive}>
        <input type="hidden" name="id" value={category.id} />
        <button className="rounded border border-line px-2 py-1 text-xs hover:bg-canvas">
          {category.isActive ? "დამალვა" : "გამოჩენა"}
        </button>
      </form>

      <form action={deleteCategory}>
        <input type="hidden" name="id" value={category.id} />
        <button className="rounded border border-line px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">
          წაშლა
        </button>
      </form>
    </div>
  );
}
