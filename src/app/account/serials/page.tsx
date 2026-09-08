import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/customer-auth";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "სერიული ნომრები" };

export default async function SerialsPage() {
  const user = (await getCurrentUser())!;

  const items = await db.orderItem.findMany({
    where: { order: { userId: user.id }, serialNumbers: { not: null } },
    include: { order: { select: { number: true, createdAt: true, id: true } } },
    orderBy: { order: { createdAt: "desc" } },
  });

  const rows = items.flatMap((it) =>
    (it.serialNumbers ?? "")
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((serial) => ({ serial, name: it.name, sku: it.sku, order: it.order }))
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">სერიული ნომრები</h1>
        <p className="mt-1 text-sm text-muted">
          ნომრები მიწოდებისას ჩაიწერება — სერვისში მიმართვისას ეს სია გამოგადგება.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="card p-6 text-center text-muted">
          სერიული ნომრები ჯერ არ დაფიქსირებულა.
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">სერიული ნომერი</th>
                <th className="px-4 py-3 font-medium">პროდუქტი</th>
                <th className="px-4 py-3 font-medium">შეკვეთა</th>
                <th className="px-4 py-3 font-medium">თარიღი</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => (
                <tr key={`${r.serial}-${i}`}>
                  <td className="px-4 py-3 font-mono">{r.serial}</td>
                  <td className="px-4 py-3">
                    {r.name}
                    <span className="ml-1.5 text-muted">#{r.sku}</span>
                  </td>
                  <td className="px-4 py-3">{r.order.number}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(r.order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
