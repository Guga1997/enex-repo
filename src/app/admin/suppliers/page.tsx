import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { adapterNames } from "@/lib/suppliers";
import {
  deleteSupplier,
  runSupplierSync,
  saveSupplier,
  testSupplier,
} from "../actions";
import SupplierForm from "@/components/admin/SupplierForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "მიმწოდებლები" };

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ test?: string; error?: string; edit?: string }>;
}) {
  const { test, error, edit } = await searchParams;

  const suppliers = await db.supplier.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { supplies: true } },
      syncLogs: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });

  const editing = edit ? suppliers.find((s) => s.id === edit) ?? null : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">მიმწოდებლები</h1>
        <p className="mt-1 text-sm text-muted">
          თითოეული კომპანიის API-დან კატალოგი და ნაშთი შემოდის. ერთი და იგივე ნივთი
          რამდენიმე მიმწოდებელს რომ ჰქონდეს, კატალოგში ერთ ბარათად რჩება და ნაშთი
          იკრიბება.
        </p>
      </div>

      {test && (
        <p className="card border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{test}</p>
      )}
      {error && (
        <p className="card border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="p-3 font-medium">კომპანია</th>
              <th className="p-3 font-medium">ადაპტერი</th>
              <th className="p-3 font-medium">პოზიცია</th>
              <th className="p-3 font-medium">ფასდადება</th>
              <th className="p-3 font-medium">ბოლო სინქი</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted">
                  მიმწოდებელი ჯერ დამატებული არ არის.
                </td>
              </tr>
            )}
            {suppliers.map((s) => {
              const last = s.syncLogs[0];
              return (
                <tr key={s.id} className={s.isActive ? "" : "opacity-50"}>
                  <td className="p-3">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted">{s.baseUrl ?? "მისამართი არ არის"}</div>
                  </td>
                  <td className="p-3 text-xs">{s.adapter}</td>
                  <td className="p-3">{s._count.supplies}</td>
                  <td className="p-3 text-xs">
                    საცალო +{s.markupRetail}%
                    <br />
                    სადილერო +{s.markupDealer}%
                  </td>
                  <td className="p-3 text-xs">
                    {s.lastSyncAt ? (
                      <>
                        <span
                          className={
                            s.lastSyncStatus === "OK" ? "text-emerald-700" : "text-rose-700"
                          }
                        >
                          {s.lastSyncStatus === "OK" ? "წარმატებით" : "შეცდომით"}
                        </span>
                        <br />
                        <span className="text-muted">{formatDate(s.lastSyncAt)}</span>
                        {last && (
                          <div className="text-muted">
                            +{last.created} ახალი · {last.updated} განახლდა
                            {last.failed > 0 ? ` · ${last.failed} ჩავარდა` : ""}
                          </div>
                        )}
                        {last?.message && (
                          <div className="mt-1 max-w-64 text-rose-700">{last.message}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted">არასდროს</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <form action={testSupplier}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-canvas">
                          შემოწმება
                        </button>
                      </form>
                      <form action={runSupplierSync}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-600">
                          სინქი
                        </button>
                      </form>
                      <a
                        href={`/admin/suppliers?edit=${s.id}`}
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-canvas"
                      >
                        რედაქტირება
                      </a>
                      <form action={deleteSupplier}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                          წაშლა
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SupplierForm
        action={saveSupplier}
        adapters={adapterNames()}
        supplier={
          editing
            ? {
                id: editing.id,
                name: editing.name,
                adapter: editing.adapter,
                baseUrl: editing.baseUrl,
                authType: editing.authType,
                authHeader: editing.authHeader,
                fieldMap: editing.fieldMap,
                markupRetail: editing.markupRetail,
                markupDealer: editing.markupDealer,
                isActive: editing.isActive,
                hasSecret: Boolean(editing.secret),
              }
            : null
        }
      />
    </div>
  );
}
