import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/customer-auth";
import { gel, formatDate } from "@/lib/format";
import {
  ORDER_BUCKETS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  DELIVERY_METHOD_LABELS,
  type OrderBucket,
} from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "ჩემი შეკვეთები" };

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = (await getCurrentUser())!;
  const { tab } = await searchParams;
  const active: OrderBucket =
    tab === "done" || tab === "returned" ? tab : "current";

  const orders = await db.order.findMany({
    where: { userId: user.id, status: { in: [...ORDER_BUCKETS[active].statuses] } },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  const counts = await Promise.all(
    (Object.keys(ORDER_BUCKETS) as OrderBucket[]).map(async (key) => ({
      key,
      count: await db.order.count({
        where: { userId: user.id, status: { in: [...ORDER_BUCKETS[key].statuses] } },
      }),
    }))
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{ORDER_BUCKETS[active].label}</h1>

      <div className="flex flex-wrap gap-2">
        {counts.map(({ key, count }) => (
          <Link
            key={key}
            href={`/account/orders?tab=${key}`}
            className={`rounded-lg border px-3 py-2 text-sm transition ${
              key === active
                ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                : "border-line bg-surface hover:bg-canvas"
            }`}
          >
            {ORDER_BUCKETS[key].label}
            <span className="ml-1.5 text-muted">({count})</span>
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-muted">ამ განყოფილებაში შეკვეთა არ არის.</p>
          <Link href="/catalog" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
            კატალოგში გადასვლა
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link key={o.id} href={`/order/${o.id}`} className="card block p-4 hover:border-brand-200">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{o.number}</span>
                <span className="text-sm text-muted">{formatDate(o.createdAt)}</span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                <span>{o.items.length} პოზიცია</span>
                <span>{DELIVERY_METHOD_LABELS[o.deliveryMethod] ?? o.deliveryMethod}</span>
                <span>{PAYMENT_METHOD_LABELS[o.paymentMethod] ?? o.paymentMethod}</span>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium">
                  {ORDER_STATUS_LABELS[o.status] ?? o.status}
                </span>
                <span className="text-lg font-bold">{gel(o.total)}</span>
              </div>

              {o.returnedAt && (
                <p className="mt-2 text-sm text-rose-700">
                  დაბრუნებულია {formatDate(o.returnedAt)}
                  {o.returnReason ? ` — ${o.returnReason}` : ""}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
