import Link from "next/link";
import { db } from "@/lib/db";
import { gel, formatDate } from "@/lib/format";
import { ORDER_STATUS_LABELS, STOCK_LABELS } from "@/lib/constants";
import { StockStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "მიმოხილვა" };

export default async function AdminDashboard() {
  const [products, active, outOfStock, lowStock, orders, pending, revenue, recent] =
    await Promise.all([
      db.product.count(),
      db.product.count({ where: { isActive: true } }),
      db.product.count({ where: { stockStatus: StockStatus.OUT_OF_STOCK } }),
      db.product.count({
        where: { stockStatus: StockStatus.IN_STOCK, stockQty: { gt: 0, lte: 5 } },
      }),
      db.order.count(),
      db.order.count({ where: { status: "PENDING" } }),
      db.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { total: true } }),
      db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">მიმოხილვა</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="პროდუქტები" value={products} hint={`აქტიური: ${active}`} href="/admin/products" />
        <Stat label="შეკვეთები" value={orders} hint={`დასამუშავებელი: ${pending}`} href="/admin/orders" />
        <Stat label="გაყიდვები (გადახდილი)" value={gel(revenue._sum.total ?? 0)} />
        <Stat
          label="მარაგის გაფრთხილება"
          value={outOfStock + lowStock}
          hint={`ამოწურული: ${outOfStock} · ბოლო ერთეულები: ${lowStock}`}
          href="/admin/products?stock=alert"
        />
      </div>

      <section className="card">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-semibold">ბოლო შეკვეთები</h2>
          <Link href="/admin/orders" className="text-sm text-brand-600 hover:underline">
            ყველა →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">შეკვეთები ჯერ არ არის.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="p-3 font-medium">ნომერი</th>
                <th className="p-3 font-medium">მომხმარებელი</th>
                <th className="p-3 font-medium">თარიღი</th>
                <th className="p-3 font-medium">სტატუსი</th>
                <th className="p-3 text-right font-medium">თანხა</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recent.map((o) => (
                <tr key={o.id} className="hover:bg-canvas">
                  <td className="p-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-medium text-brand-600 hover:underline">
                      {o.number}
                    </Link>
                  </td>
                  <td className="p-3">{o.customerName}</td>
                  <td className="p-3 text-muted">{formatDate(o.createdAt)}</td>
                  <td className="p-3">{ORDER_STATUS_LABELS[o.status] ?? o.status}</td>
                  <td className="p-3 text-right font-medium">{gel(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-2 font-semibold">სტოკის სტატუსები</h2>
        <p className="text-sm text-muted">
          {Object.entries(STOCK_LABELS)
            .map(([, label]) => label)
            .join(" · ")}
        </p>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="card p-5 transition hover:border-brand-200">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
