import Image from "next/image";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { gel } from "@/lib/format";
import { STOCK_LABELS } from "@/lib/constants";
import { productFilter } from "@/lib/admin-filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "პროდუქტის მომწოდებელი" };

const LIMIT = 50;

/**
 * „ვისგან მოდის?“ — გაყიდვებისთვის: პროდუქტის ძებნა და მისი მომწოდებელი.
 * მხოლოდ სანახავია: არც ფორმა, არც ბმული რედაქტირებაზე. თვითღირებულება და
 * მომწოდებლის ფასები აქ არ ჩანს — მხოლოდ ვინ აწვდის, მისი კოდი და ნაშთი.
 */
export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff("/admin/sources");
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);

  const where = q ? productFilter({ q }) : null;
  const [items, total] = where
    ? await Promise.all([
        db.product.findMany({
          where,
          select: {
            id: true, sku: true, model: true, nameKa: true, price: true, isActive: true,
            stockQty: true, stockAdjust: true, stockStatus: true,
            brand: { select: { name: true } },
            images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
            supplies: {
              orderBy: { qty: "desc" },
              select: { supplierSku: true, qty: true, supplier: { select: { name: true, isActive: true } } },
            },
          },
          orderBy: [{ isActive: "desc" }, { stockQty: "desc" }, { nameKa: "asc" }],
          take: LIMIT,
        }),
        db.product.count({ where }),
      ])
    : [[], 0];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">პროდუქტის მომწოდებელი</h1>
        <p className="mt-1 text-sm text-muted">მოძებნე პროდუქტი — ნახავ, ვისგან მოდის და რამდენი აქვს. მხოლოდ სანახავია.</p>
      </div>

      <form className="card flex flex-wrap gap-3 p-4">
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="დასახელება, კოდი ან მოდელი"
          className="min-w-56 flex-1 rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
        />
        <button className="btn btn-primary hover:bg-brand-600">ძებნა</button>
      </form>

      {!q ? (
        <p className="card p-10 text-center text-muted">ჩაწერე დასახელება, კოდი ან მოდელი.</p>
      ) : items.length === 0 ? (
        <p className="card p-10 text-center text-muted">„{q}“ — ვერაფერი მოიძებნა.</p>
      ) : (
        <>
          <p className="text-sm text-muted">
            ნაპოვნია {total}
            {total > LIMIT ? ` — ნაჩვენებია პირველი ${LIMIT}; დააზუსტე ძებნა` : ""}
          </p>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs text-muted">
                <tr>
                  <th className="p-3 font-medium" colSpan={2}>პროდუქტი</th>
                  <th className="p-3 font-medium">მომწოდებელი</th>
                  <th className="p-3 text-right font-medium">საიტზე ნაშთი</th>
                  <th className="p-3 text-right font-medium">ფასი</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="w-16 p-2">
                      <span className="relative block size-12 overflow-hidden rounded bg-white">
                        {p.images[0] && <Image src={p.images[0].url} alt="" fill sizes="48px" className="object-contain p-0.5" />}
                      </span>
                    </td>
                    <td className="max-w-md p-3">
                      <div className="font-medium">{p.nameKa}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span className="font-mono">{p.sku}</span>
                        {p.model && p.model !== p.sku && <span>{p.model}</span>}
                        {p.brand && <span>{p.brand.name}</span>}
                        {!p.isActive && <span className="rounded bg-canvas px-1.5 py-0.5">საიტზე არ ჩანს</span>}
                      </div>
                    </td>
                    <td className="p-3">
                      {p.supplies.length === 0 ? (
                        <span className="text-muted">ჩვენი (მომწოდებლის გარეშე)</span>
                      ) : (
                        p.supplies.map((s, i) => (
                          <div key={i} className="whitespace-nowrap">
                            <b>{s.supplier.name}</b>
                            <span className="text-muted">
                              {" "}· ნაშთი {s.qty}
                              {s.supplierSku !== p.sku ? ` · კოდი ${s.supplierSku}` : ""}
                              {!s.supplier.isActive ? " · გამორთულია" : ""}
                            </span>
                          </div>
                        ))
                      )}
                      {p.supplies.length > 0 && p.stockAdjust > 0 && (
                        <div className="whitespace-nowrap text-muted">ჩვენს საწყობში: {p.stockAdjust}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-3 text-right">
                      <div className="font-semibold">{p.stockQty}</div>
                      <div className="text-xs text-muted">{STOCK_LABELS[p.stockStatus] ?? p.stockStatus}</div>
                    </td>
                    <td className="whitespace-nowrap p-3 text-right">{p.price > 0 ? gel(p.price) : "ფასი მოთხოვნით"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
