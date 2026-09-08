import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { gel, formatDate } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants";
import { setItemSerials, updateOrderStatus } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "შეკვეთის დეტალები" };

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/orders" className="text-sm text-muted hover:text-brand-600">
            ← შეკვეთები
          </Link>
          <h1 className="text-2xl font-bold">{order.number}</h1>
        </div>
        <div className="text-right text-sm text-muted">{formatDate(order.createdAt)}</div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <section className="card">
            <h2 className="border-b border-line p-4 font-semibold">პროდუქტები</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td className="p-3" colSpan={3}>
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <div>
                          <div>{i.name}</div>
                          <div className="text-xs text-muted">#{i.sku}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted">
                            {gel(i.price)} × {i.qty}
                          </div>
                          <div className="font-medium">{gel(i.price * i.qty)}</div>
                        </div>
                      </div>

                      {/* სერიული ნომრები და გარანტია — მომხმარებლის კაბინეტში აქედან ჩნდება */}
                      <form
                        action={setItemSerials}
                        className="mt-3 grid gap-2 rounded-lg bg-canvas p-3 sm:grid-cols-[1fr_7rem_auto]"
                      >
                        <input type="hidden" name="itemId" value={i.id} />
                        <input type="hidden" name="orderId" value={order.id} />
                        <label className="block">
                          <span className="mb-1 block text-xs text-muted">
                            სერიული ნომრები — თითო ხაზზე ერთი
                          </span>
                          <textarea
                            name="serialNumbers"
                            rows={i.qty > 2 ? 3 : 2}
                            defaultValue={i.serialNumbers ?? ""}
                            className="w-full rounded-lg border border-line px-2.5 py-1.5 font-mono text-xs outline-none focus:border-brand-500"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs text-muted">გარანტია, თვე</span>
                          <input
                            name="warrantyMonths"
                            type="number"
                            min="0"
                            defaultValue={i.warrantyMonths ?? ""}
                            className="w-full rounded-lg border border-line px-2.5 py-1.5 text-xs outline-none focus:border-brand-500"
                          />
                          {i.warrantyUntil && (
                            <span className="mt-1 block text-xs text-muted">
                              {formatDate(i.warrantyUntil)}-მდე
                            </span>
                          )}
                        </label>
                        <div className="flex items-end">
                          <button className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium hover:bg-canvas">
                            შენახვა
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-line">
                <tr>
                  <td colSpan={2} className="p-3 text-right text-muted">პროდუქტები</td>
                  <td className="p-3 text-right">{gel(order.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="p-3 text-right text-muted">მიწოდება</td>
                  <td className="p-3 text-right">
                    {order.deliveryFee === 0 ? "უფასო" : gel(order.deliveryFee)}
                  </td>
                </tr>
                <tr className="border-t border-line">
                  <td colSpan={2} className="p-3 text-right font-semibold">ჯამი</td>
                  <td className="p-3 text-right text-base font-bold">{gel(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="card grid gap-4 p-5 sm:grid-cols-2">
            <h2 className="font-semibold sm:col-span-2">მომხმარებელი</h2>
            <Info label="სახელი" value={order.customerName} />
            <Info label="ტელეფონი" value={order.customerPhone} />
            <Info label="ელფოსტა" value={order.customerEmail} />
            <Info label="პირადი ნომერი" value={order.customerId ?? ""} />
            {order.companyName && <Info label="კომპანია" value={order.companyName} />}
            <Info
              label="მიწოდება"
              value={
                order.deliveryMethod === "PICKUP"
                  ? "თვითგატანა"
                  : `${order.deliveryCity ?? ""} ${order.deliveryAddress ?? ""}`.trim()
              }
            />
            {order.comment && <Info label="კომენტარი" value={order.comment} />}
          </section>
        </div>

        <div className="space-y-5">
          <form action={updateOrderStatus} className="card space-y-4 p-5">
            <input type="hidden" name="id" value={order.id} />
            <h2 className="font-semibold">სტატუსის მართვა</h2>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">შეკვეთის სტატუსი</span>
              <select
                name="status"
                defaultValue={order.status}
                className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              >
                {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">გადახდის სტატუსი</span>
              <select
                name="paymentStatus"
                defaultValue={order.paymentStatus}
                className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              >
                {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">
                ხელით შეცვლა ნაშთს არ ცვლის — ჩამოწერა ხდება მხოლოდ ბანკის დადასტურებაზე.
              </span>
            </label>

            <button className="btn btn-primary w-full hover:bg-brand-600">შენახვა</button>
          </form>

          <section className="card space-y-3 p-5 text-sm">
            <h2 className="font-semibold">გადახდა</h2>
            <Info label="მეთოდი" value={PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod} />
            <Info label="სტატუსი" value={PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus} />
            <Info label="ტრანზაქციის ID" value={order.paymentId ?? ""} />
          </section>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-medium break-words">{value || "—"}</div>
    </div>
  );
}
