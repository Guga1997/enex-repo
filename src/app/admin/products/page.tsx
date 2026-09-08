import Link from "next/link";
import Image from "next/image";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { gel } from "@/lib/format";
import { STOCK_LABELS, StockStatus } from "@/lib/constants";
import { deleteProduct, toggleProductActive } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "პროდუქტები" };

const PER_PAGE = 30;

export default async function AdminProducts({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; stock?: string; page?: string; saved?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ProductWhereInput = {};
  if (sp.q) {
    where.OR = [
      { nameKa: { contains: sp.q } },
      { sku: { contains: sp.q } },
      { model: { contains: sp.q } },
    ];
  }
  if (sp.category) where.categoryId = sp.category;
  if (sp.stock === "alert") {
    where.OR = [
      { stockStatus: StockStatus.OUT_OF_STOCK },
      { stockStatus: StockStatus.IN_STOCK, stockQty: { gt: 0, lte: 5 } },
    ];
  }

  const [items, total, categories] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        category: { select: { nameKa: true } },
        brand: { select: { name: true } },
        images: { select: { url: true }, take: 1, orderBy: { sortOrder: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.product.count({ where }),
    db.category.findMany({ orderBy: { nameKa: "asc" } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">პროდუქტები <span className="text-base font-normal text-muted">({total})</span></h1>
        <Link href="/admin/products/new" className="btn btn-primary hover:bg-brand-600">
          + ახალი პროდუქტი
        </Link>
      </div>

      {sp.saved && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          პროდუქტი შენახულია.
        </p>
      )}

      <form className="card flex flex-wrap gap-3 p-4">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="ძებნა დასახელებით, კოდით, მოდელით"
          className="min-w-56 flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <select
          name="category"
          defaultValue={sp.category ?? ""}
          className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
        >
          <option value="">ყველა კატეგორია</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nameKa}</option>
          ))}
        </select>
        <select
          name="stock"
          defaultValue={sp.stock ?? ""}
          className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
        >
          <option value="">ნებისმიერი მარაგი</option>
          <option value="alert">მარაგის გაფრთხილება</option>
        </select>
        <button className="btn btn-outline">ფილტრი</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-3xl text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="p-3 font-medium">პროდუქტი</th>
              <th className="p-3 font-medium">კატეგორია</th>
              <th className="p-3 font-medium">ფასი</th>
              <th className="p-3 font-medium">ნაშთი</th>
              <th className="p-3 font-medium">სტატუსი</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((p) => (
              <tr key={p.id} className={p.isActive ? "" : "opacity-50"}>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="relative size-10 shrink-0 rounded border border-line bg-white">
                      {p.images[0] && (
                        <Image src={p.images[0].url} alt="" fill className="object-contain p-1" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="line-clamp-1 font-medium text-brand-600 hover:underline"
                      >
                        {p.nameKa}
                      </Link>
                      <div className="text-xs text-muted">
                        #{p.sku}{p.brand ? ` · ${p.brand.name}` : ""}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-muted">{p.category.nameKa}</td>
                <td className="p-3">
                  <div className="font-medium">{gel(p.price)}</div>
                  {p.oldPrice && <div className="text-xs text-muted line-through">{gel(p.oldPrice)}</div>}
                </td>
                <td className="p-3">
                  <span className={p.stockQty <= p.lowStockAt ? "font-medium text-amber-600" : ""}>
                    {p.stockQty}
                  </span>
                </td>
                <td className="p-3 text-xs">{STOCK_LABELS[p.stockStatus] ?? p.stockStatus}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <form action={toggleProductActive}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="rounded border border-line px-2 py-1 text-xs hover:bg-canvas">
                        {p.isActive ? "დამალვა" : "გამოჩენა"}
                      </button>
                    </form>
                    <form action={deleteProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="rounded border border-line px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">
                        წაშლა
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted">
                  პროდუქტი ვერ მოიძებნა.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => {
            const params = new URLSearchParams(
              Object.entries(sp).filter(([, v]) => v) as [string, string][]
            );
            params.set("page", String(n));
            return (
              <Link
                key={n}
                href={`/admin/products?${params}`}
                className={`btn min-w-10 ${n === page ? "btn-primary" : "btn-outline"}`}
              >
                {n}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
