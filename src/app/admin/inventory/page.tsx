import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { gel } from "@/lib/format";
import { STOCK_LABELS } from "@/lib/constants";
import { productFilter } from "@/lib/admin-filters";
import { availableQty } from "@/lib/stock";
import StockControl from "@/components/admin/StockControl";
import { resetAdjust } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "მარაგი" };

const PER_PAGE = 50;

type SP = {
  q?: string; category?: string; supplier?: string; status?: string;
  stock?: string; sort?: string; dir?: string; page?: string;
};

const TABS = [
  { key: "", label: "ყველა" },
  { key: "in", label: "მარაგშია" },
  { key: "low", label: "ცოტაა (1–5)" },
  { key: "out", label: "არ არის" },
  { key: "reserved", label: "დაკავებული" },
  { key: "adjusted", label: "ხელით შეცვლილი" },
];

/** სვეტი → დალაგება; სათაურზე დაჭერა მიმართულებას ცვლის */
const SORTS: Record<string, (d: Prisma.SortOrder) => Prisma.ProductOrderByWithRelationInput> = {
  name: (d) => ({ nameKa: d }),
  category: (d) => ({ category: { nameKa: d } }),
  qty: (d) => ({ stockQty: d }),
  reserved: (d) => ({ reservedQty: d }),
  adjust: (d) => ({ stockAdjust: d }),
  price: (d) => ({ price: d }),
};
const TEXT_SORTS = new Set(["name", "category"]);

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = sp.sort && SORTS[sp.sort] ? sp.sort : "qty";
  const fallbackDir: Prisma.SortOrder = TEXT_SORTS.has(sort) ? "asc" : "desc";
  const dir: Prisma.SortOrder = sp.dir === "asc" || sp.dir === "desc" ? sp.dir : fallbackDir;
  const where = productFilter(sp);

  const [items, total, categories, suppliers, counts] = await Promise.all([
    db.product.findMany({
      where,
      select: {
        id: true, sku: true, nameKa: true, price: true, isActive: true, stockQty: true,
        reservedQty: true, stockAdjust: true, stockStatus: true,
        category: { select: { nameKa: true } },
        supplies: { select: { qty: true, supplier: { select: { name: true } } } },
      },
      orderBy: [SORTS[sort](dir), { nameKa: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.product.count({ where }),
    db.category.findMany({ where: { products: { some: {} } }, orderBy: { nameKa: "asc" }, select: { id: true, nameKa: true } }),
    db.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    Promise.all(TABS.map((t) => db.product.count({ where: productFilter({ ...sp, stock: t.key }) }))),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, page: undefined, ...patch })) if (v) next.set(k, String(v));
    const qs = next.toString();
    return qs ? `/admin/inventory?${qs}` : "/admin/inventory";
  };
  const Th = ({ id, right, children }: { id: string; right?: boolean; children: React.ReactNode }) => (
    <th className={`p-3 font-medium ${right ? "text-right" : ""}`}>
      <Link
        href={href({ sort: id, dir: sort === id ? (dir === "asc" ? "desc" : "asc") : undefined })}
        className="whitespace-nowrap hover:text-ink"
      >
        {children}
        {sort === id && <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>}
      </Link>
    </th>
  );
  const select = "rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">მარაგი</h1>
          <p className="mt-1 text-sm text-muted">
            ნაშთი = მიმწოდებლების ჯამი + ხელით კორექცია. კორექცია სინქზე არ იშლება.
          </p>
        </div>
        <Link href="/admin/stock" className="text-sm font-medium text-brand-600 hover:underline">
          ცვლილებების ლოგი →
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t, i) => {
          const active = (sp.stock ?? "") === t.key;
          return (
            <Link
              key={t.key}
              href={href({ stock: t.key || undefined })}
              className={`rounded-full border px-4 py-1.5 text-sm ${
                active ? "border-brand-500 bg-brand-500 font-medium text-white" : "border-line bg-surface hover:border-brand-500"
              }`}
            >
              {t.label} <span className={active ? "text-white/80" : "text-muted"}>{counts[i]}</span>
            </Link>
          );
        })}
      </div>

      <form className="card flex flex-wrap gap-3 p-4">
        {sp.stock && <input type="hidden" name="stock" value={sp.stock} />}
        {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
        {sp.dir && <input type="hidden" name="dir" value={sp.dir} />}
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="ძებნა დასახელებით, კოდით, მოდელით"
          className="min-w-56 flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <select name="supplier" defaultValue={sp.supplier ?? ""} className={select}>
          <option value="">ყველა წყარო</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value="manual">ხელით შექმნილი</option>
        </select>
        <select name="category" defaultValue={sp.category ?? ""} className={select}>
          <option value="">ყველა კატეგორია</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.nameKa}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={select}>
          <option value="">ჩანს და დამალული</option>
          <option value="active">მხოლოდ საიტზე ჩანს</option>
          <option value="hidden">მხოლოდ დამალული</option>
        </select>
        <button className="btn btn-outline">ფილტრი</button>
        {(sp.q || sp.supplier || sp.category || sp.status) && (
          <Link
            href={href({ q: undefined, supplier: undefined, category: undefined, status: undefined })}
            className="btn text-muted hover:text-ink"
          >
            გასუფთავება
          </Link>
        )}
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <Th id="name">დასახელება</Th>
              <Th id="category">კატეგორია</Th>
              <th className="p-3 font-medium">მიმწოდებელი</th>
              <Th id="adjust" right>კორექცია</Th>
              <Th id="reserved" right>დაკავებული</Th>
              <Th id="price" right>ფასი</Th>
              <Th id="qty">ნაშთი</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="max-w-md p-3">
                  <Link href={`/admin/products/${p.id}`} className="font-medium hover:text-brand-600">
                    {p.nameKa}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Link
                      href={`/admin/stock?sku=${encodeURIComponent(p.sku)}`}
                      title="ამ პროდუქტის ლოგი"
                      className="font-mono hover:underline"
                    >
                      {p.sku}
                    </Link>
                    <span>{STOCK_LABELS[p.stockStatus] ?? p.stockStatus}</span>
                    {!p.isActive && <span className="rounded bg-canvas px-1.5 py-0.5">დამალული</span>}
                  </div>
                </td>
                <td className="p-3 text-xs text-muted">{p.category.nameKa}</td>
                <td className="p-3 text-xs">
                  {p.supplies.length === 0 && <span className="text-muted">ხელით შექმნილი</span>}
                  {p.supplies.map((s, i) => (
                    <div key={i} className="whitespace-nowrap">
                      {s.supplier.name}: <b>{s.qty}</b>
                    </div>
                  ))}
                </td>
                <td className="p-3 text-right">
                  {p.stockAdjust !== 0 ? (
                    <form action={resetAdjust} className="inline-flex items-center justify-end gap-1.5">
                      <input type="hidden" name="id" value={p.id} />
                      <span className={`font-semibold ${p.stockAdjust > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {p.stockAdjust > 0 ? `+${p.stockAdjust}` : p.stockAdjust}
                      </span>
                      <button
                        title="კორექციის მოხსნა — ნაშთი მიმწოდებლების ჯამი გახდება"
                        aria-label="კორექციის მოხსნა"
                        className="text-xs text-muted hover:text-rose-600"
                      >
                        ✕
                      </button>
                    </form>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  {p.reservedQty > 0 ? (
                    <span title={`ხელმისაწვდომი: ${availableQty(p)}`} className="font-medium text-amber-600">
                      {p.reservedQty}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap p-3 text-right">{gel(p.price)}</td>
                <td className="p-3">
                  <StockControl productId={p.id} qty={p.stockQty} />
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-muted">ამ ფილტრით პროდუქტი არ არის.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={href({ page: String(page - 1) })} className="btn btn-outline">← წინა</Link>}
          <span className="text-muted">გვერდი {page} / {pages} · სულ {total}</span>
          {page < pages && <Link href={href({ page: String(page + 1) })} className="btn btn-outline">შემდეგი →</Link>}
        </nav>
      )}
    </div>
  );
}
