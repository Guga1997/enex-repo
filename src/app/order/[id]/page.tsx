import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { gel, formatDate } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "შეკვეთა" };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; failed?: string; payment_error?: string }>;
}) {
  const { id } = await params;
  const flags = await searchParams;

  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) notFound();

  const paid = order.paymentStatus === "PAID";

  return (
    <>
      <Suspense>
        <Header />
      </Suspense>

      <main className="container-x max-w-3xl py-8">
        <div
          className={`card p-6 text-center ${
            paid ? "border-emerald-200 bg-emerald-50" : ""
          }`}
        >
          <div className="text-3xl">{paid ? "✓" : flags.failed ? "✕" : "⏳"}</div>
          <h1 className="mt-2 text-xl font-bold">
            {paid
              ? "შეკვეთა წარმატებით გაფორმდა"
              : flags.failed
                ? "გადახდა ვერ შესრულდა"
                : "შეკვეთა მიღებულია"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            შეკვეთის ნომერი: <b className="text-ink">{order.number}</b>
          </p>

          {!paid && order.paymentMethod === "BANK_TRANSFER" && (
            <p className="mt-3 text-sm text-muted">
              ინვოისს გამოგიგზავნით ელფოსტაზე {order.customerEmail}.
              {order.invoiceSentAt && (
                <>
                  {" "}
                  <a
                    href={`/order/${order.id}/invoice`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand-600 hover:underline"
                  >
                    ინვოისის ნახვა
                  </a>
                </>
              )}
            </p>
          )}
          {!paid && order.paymentMethod === "INSTALLMENT" && (
            <p className="mt-3 text-sm text-muted">
              განვადების გასაფორმებლად ოპერატორი დაგიკავშირდებათ ნომერზე {order.customerPhone}.
            </p>
          )}
          {flags.payment_error && (
            <p className="mt-3 text-sm text-rose-600">
              გადახდის სისტემასთან დაკავშირება ვერ მოხერხდა. დაგვიკავშირდით
              შეკვეთის ნომრით.
            </p>
          )}
        </div>

        <div className="card mt-6 divide-y divide-line">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Info label="თარიღი" value={formatDate(order.createdAt)} />
            <Info label="სტატუსი" value={ORDER_STATUS_LABELS[order.status] ?? order.status} />
            <Info
              label="გადახდა"
              value={`${PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod} — ${
                PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus
              }`}
            />
            <Info
              label="მიწოდება"
              value={
                order.deliveryMethod === "PICKUP"
                  ? "თვითგატანა"
                  : `${order.deliveryCity ?? ""} ${order.deliveryAddress ?? ""}`.trim()
              }
            />
            <Info label="მიმღები" value={order.customerName} />
            <Info label="ტელეფონი" value={order.customerPhone} />
          </div>

          <div className="p-5">
            <h2 className="mb-3 font-semibold">პროდუქტები</h2>
            <ul className="divide-y divide-line text-sm">
              {order.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4 py-2.5">
                  <span>
                    {i.name} <span className="text-muted">#{i.sku} × {i.qty}</span>
                  </span>
                  <span className="shrink-0 font-medium">{gel(i.price * i.qty)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 p-5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">პროდუქტები</span>
              <span>{gel(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">მიწოდება</span>
              <span>{order.deliveryFee === 0 ? "უფასო" : gel(order.deliveryFee)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <span>ჯამი</span>
              <span>{gel(order.total)}</span>
            </div>
          </div>
        </div>

        <Link href="/catalog" className="btn btn-outline mt-6 w-full">
          შოპინგის გაგრძელება
        </Link>
      </main>
      <Footer />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value || "—"}</div>
    </div>
  );
}
