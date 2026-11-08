"use client";

import Image from "next/image";
import Link from "@/components/Link";
import { useCart } from "./CartProvider";
import { gel } from "@/lib/format";
import { normalizeQty } from "@/lib/stock";
import { FREE_DELIVERY_FROM } from "@/lib/constants";
import { useT } from "@/components/LocaleProvider";
import { useEffect, useState } from "react";

type QuoteLine = { productId: string; name: string; unitPrice: number; purchasable: boolean; overStock: number | null };
type Quote = { lines: QuoteLine[]; subtotal: number };

export default function CartView() {
  const t = useT();
  const { lines, subtotal: localSubtotal, setQty, remove, ready } = useCart();

  // ფასი სერვერიდან (მომხმარებლის დონით, დღევანდელი) — localStorage-ში დამატების დროინდელია;
  // დასახელებაც მიმდინარე ენაზე; გაყიდვიდან მოხსნილი პოზიცია აქვე ჩანს და არა checkout-ზე
  const [quote, setQuote] = useState<Quote | null>(null);
  useEffect(() => {
    if (!ready || !lines.length) return;
    let cancelled = false;
    fetch("/api/cart/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: lines.map((l) => ({ productId: l.productId, qty: l.qty })) }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((q) => { if (!cancelled && q) setQuote(q as Quote); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [ready, lines]);
  const byId = new Map((quote?.lines ?? []).map((q) => [q.productId, q]));
  const subtotal = quote?.subtotal ?? localSubtotal;

  if (!ready) return <div className="card h-64 animate-pulse" />;

  if (lines.length === 0) {
    return (
      <div className="card p-12 text-center">
        <p className="text-muted">{t("კალათა ცარიელია.")}</p>
        <Link href="/catalog" className="btn btn-primary mt-4">
          {t("კატალოგში გადასვლა")}
        </Link>
      </div>
    );
  }

  const delivery = subtotal >= FREE_DELIVERY_FROM ? 0 : 15;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="card divide-y divide-line">
        {lines.map((l) => {
          const q = byId.get(l.productId);
          const price = q?.unitPrice ?? l.price;
          // სერვერმა პოზიცია საერთოდ არ დააბრუნა — აღარ იყიდება
          const gone = Boolean(quote) && !q;
          const unavailable = gone || q?.purchasable === false;
          return (
          <div key={l.productId} className="flex gap-4 p-4">
            <Link href={`/product/${l.slug}`} className="relative size-20 shrink-0 rounded-lg bg-white">
              {l.image ? (
                <Image src={l.image} alt={l.name} fill className="object-contain p-1.5" />
              ) : (
                <div className="flex size-full items-center justify-center rounded-lg bg-canvas text-[10px] text-muted">
                  {t("სურათი")}
                </div>
              )}
            </Link>

            <div className="flex-1">
              <Link href={`/product/${l.slug}`} className="text-sm font-medium hover:text-brand-600">
                {q?.name ?? l.name}
              </Link>
              <div className="mt-0.5 text-xs text-muted">#{l.sku}</div>
              {unavailable && (
                <div className="mt-1 text-xs font-medium text-rose-600">
                  {t("ეს პროდუქტი ახლა აღარ იყიდება — წაშალე კალათიდან")}
                </div>
              )}
              {!unavailable && q?.overStock != null && (
                <div className="mt-1 text-xs font-medium text-amber-600">
                  {t("მარაგშია მხოლოდ {0} ცალი", q.overStock)}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-lg border border-line">
                  <button
                    onClick={() => {
                      const next = l.qty - Math.max(1, l.qtyStep ?? 1);
                      if (next < Math.max(1, l.minQty ?? 1)) remove(l.productId);
                      else setQty(l.productId, next);
                    }}
                    className="px-3 py-1.5 text-muted hover:text-ink"
                    aria-label={t("შემცირება")}
                  >
                    −
                  </button>
                  {l.unit ? (
                    /* მეტრები ხელით იწერება — 100-დან 500-მდე ღილაკით ვერ მივა */
                    <input
                      key={l.qty}
                      type="number"
                      defaultValue={l.qty}
                      aria-label={t(l.unit)}
                      onBlur={(e) => {
                        // ველმა ზუსტად ის უნდა აჩვენოს, რაც ჩაითვლება: 700 მ შეკვრებით 915 ხდება
                        const q = normalizeQty(Number(e.target.value) || l.qty, l, l.maxQty) || l.qty;
                        e.target.value = String(q);
                        setQty(l.productId, q);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      className="w-20 border-x border-line bg-transparent py-1.5 text-center text-sm outline-none"
                    />
                  ) : (
                    <span className="w-10 border-x border-line py-1.5 text-center text-sm">{l.qty}</span>
                  )}
                  <button
                    onClick={() => setQty(l.productId, l.qty + Math.max(1, l.qtyStep ?? 1))}
                    disabled={l.maxQty > 0 && l.qty >= l.maxQty}
                    className="px-3 py-1.5 text-muted hover:text-ink disabled:opacity-30"
                    aria-label={t("გაზრდა")}
                  >
                    +
                  </button>
                </div>
                {l.unit && <span className="text-xs text-muted">{t(l.unit)}</span>}
                {l.maxQty > 0 && l.qty >= l.maxQty && (
                  <span className="text-xs text-amber-600">{l.unit ? t("მარაგშია მხოლოდ {0} {1}", l.maxQty, t(l.unit)) : t("მარაგშია მხოლოდ {0} ცალი", l.maxQty)}</span>
                )}
                <button
                  onClick={() => remove(l.productId)}
                  className="text-xs text-muted hover:text-rose-600"
                >
                  {t("წაშლა")}
                </button>
              </div>
            </div>

            <div className="text-right">
              <div className="font-bold">{gel(price * l.qty)}</div>
              {l.qty > 1 && (
                <div className="text-xs text-muted">
                  {gel(price)} × {l.qty}{l.unit ? ` ${t(l.unit)}` : ""}
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>

      <aside className="card h-fit p-5">
        <h2 className="mb-4 font-semibold">{t("შეკვეთის ჯამი")}</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t("პროდუქტები")}</dt>
            <dd>{gel(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{t("მიწოდება")}</dt>
            <dd>{delivery === 0 ? t("უფასო") : gel(delivery)}</dd>
          </div>
        </dl>
        {delivery > 0 && (
          <p className="mt-2 text-xs text-muted">
            {t("{0}-ით მეტი შეძენისას მიწოდება უფასოა.", gel(FREE_DELIVERY_FROM - subtotal))}
          </p>
        )}
        <div className="mt-4 flex justify-between border-t border-line pt-4 text-lg font-bold">
          <span>{t("ჯამი")}</span>
          <span>{gel(subtotal + delivery)}</span>
        </div>
        <Link href="/checkout" className="btn btn-primary mt-5 w-full hover:bg-brand-600">
          {t("შეკვეთის გაფორმება")}
        </Link>
        <Link href="/catalog" className="btn btn-outline mt-2 w-full">
          {t("შოპინგის გაგრძელება")}
        </Link>
      </aside>
    </div>
  );
}
