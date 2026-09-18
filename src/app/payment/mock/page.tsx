import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { gel } from "@/lib/format";
import { markOrderFailed, markOrderPaid } from "@/lib/orders";
import { isMockMode } from "@/lib/payments/bog";

/**
 * სატესტო "ბანკის გვერდი". მუშაობს მხოლოდ PAYMENT_MOCK რეჟიმში —
 * BOG-ის გასაღებების ჩაწერისთანავე ავტომატურად ითიშება.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "გადახდა (სატესტო რეჟიმი)" };

export default async function MockPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  if (!isMockMode()) notFound();

  const { order: orderId } = await searchParams;
  if (!orderId) notFound();

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) notFound();
  const settled = order.paymentStatus === "PAID" || order.status === "EXPIRED" || order.status === "CANCELLED";

  async function pay() {
    "use server";
    await markOrderPaid(orderId!);
    redirect(`/order/${orderId}?paid=1`);
  }

  async function fail() {
    "use server";
    await markOrderFailed(orderId!);
    redirect(`/order/${orderId}?failed=1`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 rounded-lg bg-amber-50 p-3 text-center text-xs font-medium text-amber-700">
          სატესტო რეჟიმი — რეალური ბანკი არ არის მიერთებული
        </div>

        <h1 className="text-lg font-bold">გადახდა</h1>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">შეკვეთა</dt>
            <dd className="font-medium">{order.number}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">მიმღები</dt>
            <dd className="font-medium">Enex</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base">
            <dt className="font-semibold">თანხა</dt>
            <dd className="font-bold">{gel(order.total)}</dd>
          </div>
        </dl>

        {settled ? (
          <p className="mt-6 rounded-lg bg-canvas p-3 text-center text-sm text-muted">
            ეს შეკვეთა უკვე დასრულებულია ({order.paymentStatus === "PAID" ? "გადახდილია" : "გაუქმებულია"}) —
            იმიტაცია აღარ მოქმედებს.{" "}
            <a href={`/order/${order.id}`} className="text-brand-600 hover:underline">შეკვეთის გვერდი</a>
          </p>
        ) : (
        <div className="mt-6 space-y-2">
          <form action={pay}>
            <button className="btn btn-primary w-full hover:bg-brand-600">
              წარმატებული გადახდის იმიტაცია
            </button>
          </form>
          <form action={fail}>
            <button className="btn btn-outline w-full text-rose-600">
              წარუმატებელი გადახდის იმიტაცია
            </button>
          </form>
        </div>
        )}
      </div>
    </main>
  );
}
