import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { fetchPaymentStatus } from "@/lib/payments/bog";
import { markOrderFailed, markOrderPaid } from "@/lib/orders";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { gel, formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
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
  const t = await getT();
  const { id } = await params;
  const flags = await searchParams;

  let order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) notFound();

  // ბანკიდან დაბრუნდა, callback კი ჯერ არ მოსულა — სტატუსს პირდაპირ ბანკს ვკითხავთ
  if ((flags.paid || flags.failed) && order.paymentStatus === "UNPAID" && order.paymentId && order.paymentMethod === "BOG") {
    const status = await fetchPaymentStatus(order.paymentId).catch(() => null);
    if (status?.key === "completed") await markOrderPaid(order.id, status.raw);
    else if (status?.key === "rejected") await markOrderFailed(order.id, status.raw);
    if (status) order = (await db.order.findUnique({ where: { id }, include: { items: true } })) ?? order;
  }

  const paid = order.paymentStatus === "PAID";
  // წარუმატებლობა ბაზაშია ჩაწერილი — გვერდზე დაბრუნებისასაც სწორად ჩანს
  const failed = !paid && (order.paymentStatus === "FAILED" || Boolean(flags.failed));
  const expired = order.status === "EXPIRED" || order.status === "CANCELLED";

  return (
    <>
      <Suspense>
        <Header />
      </Suspense>

      <main className="container-x max-w-3xl py-8">
        <div
          className={`card p-6 text-center ${
            paid ? "border-emerald-200 bg-emerald-50" : failed || expired ? "border-rose-200 bg-rose-50" : ""
          }`}
        >
          <div className="text-3xl">{paid ? "✓" : failed || expired ? "✕" : "⏳"}</div>
          <h1 className="mt-2 text-xl font-bold">
            {paid
              ? "შეკვეთა წარმატებით გაფორმდა"
              : expired
                ? order.status === "EXPIRED"
                  ? "შეკვეთის ვადა გავიდა"
                  : "შეკვეთა გაუქმებულია"
                : failed
                  ? "გადახდა ვერ შესრულდა"
                  : "შეკვეთა მიღებულია"}
          </h1>
          {!paid && !expired && order.reservedUntil && (
            <p className="mt-2 text-sm text-muted">
              {t("ნაშთი შენთვისაა დაკავებული")} <b>{formatDate(order.reservedUntil)}</b>{" "}
              {order.reservedUntil.toLocaleTimeString("ka-GE", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit" })}-მდე — ამის შემდეგ შეკვეთა
              ავტომატურად გაუქმდება.
            </p>
          )}
          {order.status === "EXPIRED" && (
            <p className="mt-2 text-sm text-muted">
              {t("გადახდა დროულად არ დადასტურდა და ნაშთი გათავისუფლდა. კალათა შენახულია — თავიდან გააფორმე.")}
            </p>
          )}
          <p className="mt-1 text-sm text-muted">
            {t("შეკვეთის ნომერი:")} <b className="text-ink">{order.number}</b>
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
                    {t("ინვოისის ნახვა")}
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
            <Info label={t("თარიღი")} value={formatDate(order.createdAt)} />
            <Info label={t("სტატუსი")} value={t(ORDER_STATUS_LABELS[order.status] ?? order.status)} />
            <Info
              label={t("გადახდა")}
              value={`${t(PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod)} — ${
                t(PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus)
              }`}
            />
            <Info
              label={t("მიწოდება")}
              value={
                order.deliveryMethod === "PICKUP"
                  ? "თვითგატანა"
                  : `${order.deliveryCity ?? ""} ${order.deliveryAddress ?? ""}`.trim()
              }
            />
            <Info label={t("მიმღები")} value={order.customerName} />
            <Info label={t("ტელეფონი")} value={order.customerPhone} />
          </div>

          <div className="p-5">
            <h2 className="mb-3 font-semibold">{t("პროდუქტები")}</h2>
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
              <span className="text-muted">{t("პროდუქტები")}</span>
              <span>{gel(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{t("მიწოდება")}</span>
              <span>{order.deliveryFee === 0 ? "უფასო" : gel(order.deliveryFee)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <span>{t("ჯამი")}</span>
              <span>{gel(order.total)}</span>
            </div>
          </div>
        </div>

        <Link href="/catalog" className="btn btn-outline mt-6 w-full">
          {t("შოპინგის გაგრძელება")}
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
