import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { gel, formatDate } from "@/lib/format";
import {
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_CLASS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants";
import { ci } from "@/lib/search-mode";
import { dayLabel, dayRange, isDay, today } from "@/lib/day";

export const dynamic = "force-dynamic";
export const metadata = { title: "შეკვეთები" };

const PER_PAGE = 30;
const field = "rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500";

/**
 * შეკვეთების სია.
 *
 * ნაგულისხმევად მხოლოდ დღევანდელი შეკვეთები ჩანს — სამუშაო სია ყოველ დილას
 * სუფთაა. სხვა დღეები კალენდრით იხსნება, ძებნა კი ყოველთვის მთელ ისტორიაში
 * მუშაობს: ნომრის ან ტელეფონის ცოდნისას თარიღის გახსენება არ უნდა დაგჭირდეს.
 */
export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();

  const from = isDay(sp.from) ? sp.from : today();
  const to = isDay(sp.to) && sp.to >= from ? sp.to : from;
  // ძებნისას თარიღი არ გვზღუდავს — თორემ ძველ შეკვეთას ვერასდროს იპოვი
  const byDay = !q;

  const where: Prisma.OrderWhereInput = {};
  if (sp.status) where.status = sp.status;
  if (byDay) where.createdAt = dayRange(from, to);
  if (q) {
    where.OR = [
      { number: ci(q) },
      { customerName: ci(q) },
      { customerPhone: ci(q) },
      { customerEmail: ci(q) },
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
  const period = from === to ? dayLabel(from) : `${dayLabel(from)} — ${dayLabel(to)}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">
          შეკვეთები <span className="text-base font-normal text-muted">({total})</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          {q ? "ძებნის შედეგი მთელ ისტორიაში" : from === today() && to === from ? `დღეს — ${period}` : period}
        </p>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">თარიღიდან</span>
          <input type="date" name="from" defaultValue={from} max={today()} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">თარიღამდე</span>
          <input type="date" name="to" defaultValue={to} max={today()} className={field} />
        </label>
        <label className="block min-w-56 flex-1">
          <span className="mb-1 block text-xs text-muted">ძებნა (ყველა თარიღში)</span>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="ნომერი, სახელი, ტელეფონი ან ელფოსტა"
            className={`w-full ${field}`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">სტატუსი</span>
          <select name="status" defaultValue={sp.status ?? ""} className={field}>
            <option value="">ყველა</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <button className="btn btn-outline">ჩვენება</button>
        <Link href="/admin/orders" className="btn btn-outline">
          დღეს
        </Link>
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
                <td className="p-3">
                  <span className={ORDER_STATUS_CLASS[o.status] ?? ""}>
                    {ORDER_STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </td>
                <td className="p-3">
                  <span className={PAYMENT_STATUS_CLASS[o.paymentStatus] ?? "text-muted"}>
                    {PAYMENT_STATUS_LABELS[o.paymentStatus] ?? o.paymentStatus}
                  </span>
                </td>
                <td className="p-3 text-right font-medium">{gel(o.total)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-muted">
                  {q ? "შეკვეთა ვერ მოიძებნა." : `${period} — შეკვეთა არ არის. სხვა დღე კალენდრიდან აირჩიე.`}
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
