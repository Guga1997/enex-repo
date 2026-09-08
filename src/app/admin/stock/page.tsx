import { db } from "@/lib/db";
import { STOCK_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "სტოკის ლოგი" };

export default async function StockLogPage({
  searchParams,
}: {
  searchParams: Promise<{ sku?: string }>;
}) {
  const { sku } = await searchParams;

  const logs = await db.stockSyncLog.findMany({
    where: sku ? { sku: { contains: sku } } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">სტოკის ცვლილებების ლოგი</h1>
      <p className="text-sm text-muted">
        ბოლო 200 ჩანაწერი — ვინ, როდის და რა შეცვალა API-ის ან ადმინის მეშვეობით.
      </p>

      <form className="card flex gap-3 p-4">
        <input
          name="sku"
          defaultValue={sku ?? ""}
          placeholder="ფილტრი SKU-ით"
          className="min-w-56 flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <button className="btn btn-outline">ძებნა</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="p-3 font-medium">თარიღი</th>
              <th className="p-3 font-medium">წყარო</th>
              <th className="p-3 font-medium">SKU</th>
              <th className="p-3 font-medium">რაოდენობა</th>
              <th className="p-3 font-medium">სტატუსი</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="p-3 text-xs text-muted">
                  {l.createdAt.toLocaleString("ka-GE")}
                </td>
                <td className="p-3">{l.source}</td>
                <td className="p-3 font-mono text-xs">{l.sku}</td>
                <td className="p-3">
                  <span className="text-muted">{l.oldQty}</span>
                  <span className="mx-1.5 text-muted">→</span>
                  <span className={l.newQty > l.oldQty ? "text-emerald-600" : "text-rose-600"}>
                    {l.newQty}
                  </span>
                </td>
                <td className="p-3 text-xs">
                  {l.oldStatus === l.newStatus ? (
                    <span className="text-muted">{STOCK_LABELS[l.newStatus] ?? l.newStatus}</span>
                  ) : (
                    <>
                      <span className="text-muted">{STOCK_LABELS[l.oldStatus] ?? l.oldStatus}</span>
                      <span className="mx-1.5 text-muted">→</span>
                      <span>{STOCK_LABELS[l.newStatus] ?? l.newStatus}</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-muted">ჩანაწერი არ არის.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
