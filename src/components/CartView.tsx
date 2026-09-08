"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { gel } from "@/lib/format";
import { FREE_DELIVERY_FROM } from "@/lib/constants";

export default function CartView() {
  const { lines, subtotal, setQty, remove, ready } = useCart();

  if (!ready) return <div className="card h-64 animate-pulse" />;

  if (lines.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-muted">კალათა ცარიელია.</p>
        <Link href="/catalog" className="btn btn-primary mt-4">
          კატალოგში გადასვლა
        </Link>
      </div>
    );
  }

  const delivery = subtotal >= FREE_DELIVERY_FROM ? 0 : 15;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="card divide-y divide-line">
        {lines.map((l) => (
          <div key={l.productId} className="flex gap-4 p-4">
            <Link href={`/product/${l.slug}`} className="relative size-20 shrink-0 rounded-lg bg-white">
              {l.image ? (
                <Image src={l.image} alt={l.name} fill className="object-contain p-1.5" />
              ) : (
                <div className="flex size-full items-center justify-center rounded-lg bg-canvas text-[10px] text-muted">
                  სურათი
                </div>
              )}
            </Link>

            <div className="flex-1">
              <Link href={`/product/${l.slug}`} className="text-sm font-medium hover:text-brand-600">
                {l.name}
              </Link>
              <div className="mt-0.5 text-xs text-muted">#{l.sku}</div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-lg border border-line">
                  <button
                    onClick={() => setQty(l.productId, l.qty - 1)}
                    className="px-3 py-1.5 text-muted hover:text-ink"
                    aria-label="შემცირება"
                  >
                    −
                  </button>
                  <span className="w-10 border-x border-line py-1.5 text-center text-sm">{l.qty}</span>
                  <button
                    onClick={() => setQty(l.productId, l.qty + 1)}
                    disabled={l.maxQty > 0 && l.qty >= l.maxQty}
                    className="px-3 py-1.5 text-muted hover:text-ink disabled:opacity-30"
                    aria-label="გაზრდა"
                  >
                    +
                  </button>
                </div>
                {l.maxQty > 0 && l.qty >= l.maxQty && (
                  <span className="text-xs text-amber-600">მარაგშია მხოლოდ {l.maxQty} ცალი</span>
                )}
                <button
                  onClick={() => remove(l.productId)}
                  className="text-xs text-muted hover:text-rose-600"
                >
                  წაშლა
                </button>
              </div>
            </div>

            <div className="text-right">
              <div className="font-bold">{gel(l.price * l.qty)}</div>
              {l.qty > 1 && <div className="text-xs text-muted">{gel(l.price)} × {l.qty}</div>}
            </div>
          </div>
        ))}
      </div>

      <aside className="card h-fit p-5">
        <h2 className="mb-4 font-semibold">შეკვეთის ჯამი</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">პროდუქტები</dt>
            <dd>{gel(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">მიწოდება</dt>
            <dd>{delivery === 0 ? "უფასო" : gel(delivery)}</dd>
          </div>
        </dl>
        {delivery > 0 && (
          <p className="mt-2 text-xs text-muted">
            {gel(FREE_DELIVERY_FROM - subtotal)}-ით მეტი შეძენისას მიწოდება უფასოა.
          </p>
        )}
        <div className="mt-4 flex justify-between border-t border-line pt-4 text-lg font-bold">
          <span>ჯამი</span>
          <span>{gel(subtotal + delivery)}</span>
        </div>
        <Link href="/checkout" className="btn btn-primary mt-5 w-full hover:bg-brand-600">
          შეკვეთის გაფორმება
        </Link>
        <Link href="/catalog" className="btn btn-outline mt-2 w-full">
          შოპინგის გაგრძელება
        </Link>
      </aside>
    </div>
  );
}
