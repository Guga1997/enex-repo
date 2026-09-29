import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatDate, gel } from "@/lib/format";
import { ROLE_LABEL, canSee, type Role } from "@/lib/workflow";
import OrderWorkflow from "@/components/admin/OrderWorkflow";

export const dynamic = "force-dynamic";
export const metadata = { title: "შეკვეთის პროცესი" };

/**
 * ერთი შეკვეთის სამუშაო ბარათი — ყველა განყოფილებისთვის ერთი გვერდი.
 *
 * ადმინის სრული შეკვეთის გვერდისგან იმით განსხვავდება, რომ აქ მხოლოდ პროცესია:
 * რა უნდა გააკეთო და ის მონაცემები, რომელთა ნახვის უფლებაც გაქვს. ტელეფონზეც
 * იკითხება — კურიერი სწორედ აქედან ადასტურებს აღებასა და მიტანას.
 */
export default async function WorkflowOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const role = session?.role ?? "ADMIN";

  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: { select: { id: true, name: true, qty: true, price: true } },
      fulfillment: true,
      steps: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const done = new Set(order.steps.map((s) => s.step));
  const seeOrder = canSee(role, "order", done);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/admin/workflow" className="text-sm text-muted hover:text-brand-600">
          ← პროცესი
        </Link>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold">{order.number}</h1>
          <span className="text-sm text-muted">{formatDate(order.createdAt)}</span>
          {role !== "ADMIN" && (
            <span className="rounded bg-canvas px-2 py-0.5 text-[11px]">
              {ROLE_LABEL[role as Role] ?? role}
            </span>
          )}
        </div>
      </div>

      {seeOrder ? (
        <section className="card p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b>{order.customerName}</b>
            <a href={`tel:${order.customerPhone}`} className="text-brand-600 hover:underline">
              {order.customerPhone}
            </a>
          </div>
          <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
            {order.items.map((it) => (
              <li key={it.id} className="flex gap-2">
                <span className="flex-1">{it.name}</span>
                <span className="shrink-0 text-muted">{it.qty} ც.</span>
                <span className="shrink-0 tabular-nums">{gel(it.price * it.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-line pt-3 font-semibold">
            <span>სულ</span>
            <span className="tabular-nums">{gel(order.total)}</span>
          </div>
        </section>
      ) : (
        <p className="card p-4 text-sm text-muted">
          შეკვეთის შიგთავსი ამ ეტაპზე არ გეხება — შენი ნაბიჯი ქვემოთაა.
        </p>
      )}

      <OrderWorkflow
        orderId={order.id}
        role={role}
        steps={order.steps}
        fulfillment={order.fulfillment}
        order={{
          deliveryCity: order.deliveryCity,
          deliveryAddress: order.deliveryAddress,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
        }}
      />
    </div>
  );
}
