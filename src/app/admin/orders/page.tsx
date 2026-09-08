import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { gel, formatDate } from "@/lib/format";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "შეკვეთები" };

const PER_PAGE = 30;

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.OrderWhereInput = {};
  if (sp.status) where.status = sp.status;
  if (sp.q) {
    where.OR = [
      { number: { contains: sp.q } },
      { customerName: { contains: sp.q } },
      { customerPhone: { contains: sp.q } },
      { customerEmail: { contains: sp.q } },
    ];
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { _count: { select: { items: true } } },
    }),
    db.order.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">
        შეკვეთები <span className="text-base font-normal text-muted">({total})</span>
      </h1>

      <form className="card flex flex-wrap gap-3 p-4">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="ნომერი, სახელი, ტელეფონი ან ელფოსტა"
          className="min-w-56 flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
        >
          <option value="">ყველა სტატუსი</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className="btn btn-outline">ფილტრი</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-3xl text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="p-3 font-medium">ნომერი</th>
              <th className="p-3 font-medium">მომხმარებელი</th>
              <th className="p-3 font-medium">თარიღი</th>
              <th className="p-3 font-medium">პოზიცია</th>
              <th className="p-3 font-medium">სტატუსი</th>
              <th className="p-3 font-medium">გადახდა</th>
              <th className="p-3 text-right font-medium">თანხა</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-canvas">
                <td className="p-3">
                  <Link href={`/admin/orders/${o.id}`} className="font-medium text-brand-600 hover:underline">
                    {o.number}
                  </Link>
                </td>
                <td className="p-3">
                  <div>{o.customerName}</div>
                  <div className="text-xs text-muted">{o.customerPhone}</div>
                </td>
                <td className="p-3 text-muted">{formatDate(o.createdAt)}</td>
                <td className="p-3 text-muted">{o._count.items}</td>
                <td className="p-3">{ORDER_STATUS_LABELS[o.status] ?? o.status}</td>
                <td className="p-3">
                  <span
                    className={
                      o.paymentStatus === "PAID"
                        ? "text-emerald-600"
                        : o.paymentStatus === "FAILED"
                          ? "text-rose-600"
                          : "text-muted"
                    }
                  >
                    {PAYMENT_STATUS_LABELS[o.paymentStatus] ?? o.paymentStatus}
                  </span>
                </td>
                <td className="p-3 text-right font-medium">{gel(o.total)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-muted">შეკვეთა ვერ მოიძებნა.</td>
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
                href={`/admin/orders?${params}`}
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
