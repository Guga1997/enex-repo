import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { gel } from "@/lib/format";
import { STOCK_LABELS } from "@/lib/constants";
import { productFilter } from "@/lib/admin-filters";
import { bulkSetActive, bulkSetActiveByFilter, deleteProduct, toggleProductActive } from "../actions";
import SelectAll from "@/components/admin/SelectAll";

export const dynamic = "force-dynamic";
export const metadata = { title: "პროდუქტები" };

const PER_PAGE = 50;

type SP = {
  q?: string; category?: string; supplier?: string; status?: string;
  stock?: string; page?: string; saved?: string;
};

export default async function AdminProducts({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = productFilter(sp);

  const [items, total, categories, suppliers, activeCount, hiddenCount] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        category: { select: { nameKa: true } },
        brand: { select: { name: true } },
        images: { select: { url: true }, take: 1, orderBy: { sortOrder: "asc" } },
        supplies: { select: { supplier: { select: { name: true } } }, take: 1 },
      },
      orderBy: [{ category: { nameKa: "asc" } }, { nameKa: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.product.count({ where }),
    db.category.findMany({ where: { products: { some: {} } }, orderBy: { nameKa: "asc" } }),
    db.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.count({ where: { isActive: true } }),
    db.product.count({ where: { isActive: false } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const filterParams = Object.entries(sp).filter(([k, v]) => v && k !== "page" && k !== "saved");
  const select = "rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">პროდუქტები</h1>
          <p className="mt-1 text-sm text-muted">
            საიტზე ჩანს <b className="text-emerald-700">{activeCount}</b> · დამალულია{" "}
            <b>{hiddenCount}</b>
          </p>
        </div>
        <Link href="/admin/products/new" className="btn btn-outline">
          + ხელით დამატება
        </Link>
      </div>

      {sp.saved && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">პროდუქტი შენახულია.</p>
      )}

      {/* ფილტრი */}
      <form className="card flex flex-wrap gap-3 p-4">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="ძებნა დასახელებით, კოდით, მოდელით"
          className="min-w-56 flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <select name="supplier" defaultValue={sp.supplier ?? ""} className={select}>
          <option value="">ყველა წყარო</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>API: {s.name}</option>
          ))}
          <option value="manual">ხელით შექმნილი</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={select}>
          <option value="">ჩანს და დამალული</option>
          <option value="active">მხოლოდ საიტზე ჩანს</option>
          <option value="hidden">მხოლოდ დამალული</option>
        </select>
        <select name="category" defaultValue={sp.category ?? ""} className={select}>
          <option value="">ყველა კატეგორია</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nameKa}</option>
          ))}
        </select>
        <select name="stock" defaultValue={sp.stock ?? ""} className={select}>
          <option value="">ნებისმიერი მარაგი</option>
          <option value="alert">მარაგის გაფრთხილება</option>
        </select>
        <button className="btn btn-outline">ფილტრი</button>
        {filterParams.length > 0 && (
          <Link href="/admin/products" className="btn text-muted hover:text-ink">გასუფთავება</Link>
        )}
      </form>

      {/* მთელ ფილტრზე — არა მხოლოდ ამ გვერდზე */}
      {total > 0 && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm">
            ფილტრში <b>{total}</b> პროდუქტია
            {pages > 1 && <span className="text-muted"> — ამ გვერდზე {items.length}</span>}
          </span>
          <form action={bulkSetActiveByFilter} className="flex gap-2">
            {filterParams.map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <button name="active" value="1" className="btn btn-primary hover:bg-brand-600">
              ყველა {total}-ის გამოქვეყნება
            </button>
            <button name="active" value="0" className="btn btn-outline">
              ყველა {total}-ის დამალვა
            </button>
          </form>
        </div>
      )}

      {/* სია — მონიშვნით */}
      <form action={bulkSetActive} id="bulk">
        <div className="card overflow-x-auto">
          <table className="w-full min-w-3xl text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="w-10 p-3"><SelectAll form="bulk" /></th>
                <th className="p-3 font-medium">პროდუქტი</th>
                <th className="p-3 font-medium">კატეგორია</th>
                <th className="p-3 font-medium">წყარო</th>
                <th className="p-3 font-medium">ფასი</th>
                <th className="p-3 font-medium">ნაშთი</th>
                <th className="p-3 font-medium">საიტზე</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((p) => (
                <tr key={p.id} className={p.isActive ? "" : "bg-canvas/60"}>
                  <td className="p-3">
                    <input type="checkbox" name="ids" value={p.id} className="size-4 accent-brand-500" />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="relative size-10 shrink-0 rounded border border-line bg-white">
                        {p.images[0] && (
                          <Image src={p.images[0].url} alt="" fill sizes="40px" className="object-contain p-1" />
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
                  <td className="p-3 text-xs text-muted">{p.category.nameKa}</td>
                  <td className="p-3 text-xs">
                    {p.supplies[0] ? (
                      <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700">
                        {p.supplies[0].supplier.name}
                      </span>
                    ) : (
                      <span className="text-muted">ხელით</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{gel(p.price)}</div>
                    {p.dealerPrice && (
                      <div className="text-xs text-muted">დილ. {gel(p.dealerPrice)}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={p.stockQty <= p.lowStockAt ? "font-medium text-amber-600" : ""}>
                      {p.stockQty}
                    </span>
                    <div className="text-xs text-muted">{STOCK_LABELS[p.stockStatus] ?? p.stockStatus}</div>
                  </td>
                  <td className="p-3">
                    {p.isActive ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">ჩანს</span>
                    ) : (
                      <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">დამალული</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button
                        formAction={toggleProductActive}
                        name="id"
                        value={p.id}
                        className="rounded border border-line px-2 py-1 text-xs hover:bg-canvas"
                      >
                        {p.isActive ? "დამალვა" : "გამოჩენა"}
                      </button>
                      <button
                        formAction={deleteProduct}
                        name="id"
                        value={p.id}
                        className="rounded border border-line px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                      >
                        წაშლა
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-muted">პროდუქტი ვერ მოიძებნა.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* მონიშნულებზე ქმედება — სიის ქვემოთ, რომ ხელი არ შეუშალოს */}
        {items.length > 0 && (
          <div className="sticky bottom-3 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-3 shadow-lg">
            <span className="text-sm text-muted">მონიშნული:</span>
            <button name="active" value="1" className="btn btn-primary hover:bg-brand-600">
              გამოქვეყნება
            </button>
            <button name="active" value="0" className="btn btn-outline">
              დამალვა
            </button>
          </div>
        )}
      </form>

      {pages > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => {
            const params = new URLSearchParams(filterParams as [string, string][]);
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
