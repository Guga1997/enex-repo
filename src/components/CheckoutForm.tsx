"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import { gel } from "@/lib/format";
import { FREE_DELIVERY_FROM, PAYMENT_METHOD_LABELS } from "@/lib/constants";

const CITIES = ["თბილისი", "ბათუმი", "ქუთაისი", "რუსთავი", "გორი", "ზუგდიდი", "თელავი", "სხვა"];

export type CheckoutUser = {
  name: string;
  email: string;
  phone: string;
  taxId: string;
  address: string;
  type: string;
} | null;

export type CheckoutOrg = { id: string; name: string; taxId: string; isDefault: boolean };

/** სერვერიდან დაბრუნებული გადათვლა */
type Quote = {
  lines: {
    productId: string; name: string; qty: number;
    unitPrice: number; retailPrice: number; lineTotal: number;
    overStock: number | null;
  }[];
  subtotal: number; retailSubtotal: number; saved: number;
  deliveryFee: number; total: number;
  weightKg: number; volumeM3: number; isDealer: boolean;
};

export default function CheckoutForm({
  user,
  organizations = [],
}: {
  user?: CheckoutUser;
  organizations?: CheckoutOrg[];
}) {
  const { lines, subtotal, clear, ready } = useCart();
  const router = useRouter();

  const [deliveryMethod, setDeliveryMethod] = useState<"COURIER" | "PICKUP">("COURIER");
  const [paymentMethod, setPaymentMethod] =
    useState<"BOG" | "BANK_TRANSFER" | "INSTALLMENT" | "POS">("BOG");
  const [isCompany, setIsCompany] = useState(user?.type === "COMPANY");
  const [organizationId, setOrganizationId] = useState(
    organizations.find((o) => o.isDefault)?.id ?? organizations[0]?.id ?? ""
  );
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* ფასს, წონასა და მოცულობას სერვერი თვლის — localStorage-ის ფასი დამატების მომენტისაა */
  useEffect(() => {
    if (!ready || lines.length === 0) return;
    const body = {
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
      deliveryMethod,
    };
    let cancelled = false;
    fetch("/api/cart/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((q) => { if (!cancelled && q) setQuote(q as Quote); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [ready, lines, deliveryMethod]);

  if (!ready) return <div className="card h-96 animate-pulse" />;

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

  const shownSubtotal = quote?.subtotal ?? subtotal;
  const deliveryFee =
    quote?.deliveryFee ??
    (deliveryMethod === "PICKUP" || subtotal >= FREE_DELIVERY_FROM ? 0 : 15);
  const total = quote?.total ?? shownSubtotal + deliveryFee;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      customerName: String(fd.get("customerName") ?? ""),
      customerPhone: String(fd.get("customerPhone") ?? ""),
      customerEmail: String(fd.get("customerEmail") ?? ""),
      customerId: String(fd.get("customerId") ?? ""),
      companyName: isCompany ? String(fd.get("companyName") ?? "") : "",
      deliveryMethod,
      deliveryCity: deliveryMethod === "COURIER" ? String(fd.get("deliveryCity") ?? "") : "",
      deliveryAddress: deliveryMethod === "COURIER" ? String(fd.get("deliveryAddress") ?? "") : "",
      comment: String(fd.get("comment") ?? ""),
      paymentMethod,
      organizationId: isCompany ? organizationId : "",
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "შეკვეთის გაფორმება ვერ მოხერხდა");
        setBusy(false);
        return;
      }

      clear();
      if (data.redirectUrl.startsWith("http")) window.location.href = data.redirectUrl;
      else router.push(data.redirectUrl);
    } catch {
      setError("კავშირის შეცდომა. სცადეთ თავიდან.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <fieldset className="card p-5">
          <legend className="px-1 font-semibold">საკონტაქტო ინფორმაცია</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field name="customerName" label="სახელი და გვარი" required defaultValue={user?.name} />
            <Field
              name="customerPhone"
              label="ტელეფონი"
              type="tel"
              placeholder="5XX XX XX XX"
              required
              defaultValue={user?.phone}
            />
            <Field name="customerEmail" label="ელფოსტა" type="email" required defaultValue={user?.email} />
            <Field
              name="customerId"
              label="პირადი ნომერი"
              hint="ზედნადებისთვის, არასავალდებულო"
              defaultValue={user?.taxId}
            />
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={isCompany}
              onChange={(e) => setIsCompany(e.target.checked)}
              className="size-4 accent-brand-500"
            />
            იურიდიული პირი
          </label>
          {isCompany && (
            <div className="mt-4">
              {organizations.length > 0 ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">ორგანიზაცია</span>
                  <select
                    value={organizationId}
                    onChange={(e) => setOrganizationId(e.target.value)}
                    className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                  >
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} — ს/კ {o.taxId}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-muted">
                    ინვოისი არჩეული ორგანიზაციის რეკვიზიტებით გამოიწერება
                  </span>
                </label>
              ) : (
                <Field name="companyName" label="კომპანიის დასახელება და ს/კ" required />
              )}
            </div>
          )}
        </fieldset>

        <fieldset className="card p-5">
          <legend className="px-1 font-semibold">მიწოდება</legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Radio
              checked={deliveryMethod === "COURIER"}
              onChange={() => setDeliveryMethod("COURIER")}
              title="ადგილზე მიტანა"
              desc={subtotal >= FREE_DELIVERY_FROM ? "უფასო" : "15₾"}
            />
            <Radio
              checked={deliveryMethod === "PICKUP"}
              onChange={() => setDeliveryMethod("PICKUP")}
              title="საწყობიდან გატანა"
              desc="უფასო"
            />
          </div>

          {deliveryMethod === "COURIER" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">ქალაქი</span>
                <select
                  name="deliveryCity"
                  className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                >
                  {CITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <Field name="deliveryAddress" label="მისამართი" required />
            </div>
          )}
        </fieldset>

        <fieldset className="card p-5">
          <legend className="px-1 font-semibold">გადახდის მეთოდი</legend>
          <div className="mt-4 space-y-3">
            {(["BOG", "BANK_TRANSFER", "POS", "INSTALLMENT"] as const).map((m) => (
              <Radio
                key={m}
                checked={paymentMethod === m}
                onChange={() => setPaymentMethod(m)}
                title={PAYMENT_METHOD_LABELS[m]}
                desc={
                  m === "BANK_TRANSFER"
                    ? "ინვოისი მაშინვე მოვა " + (user?.email ?? "მითითებულ ელფოსტაზე")
                    : m === "POS"
                      ? "ბარათით გადაიხდი ნივთის მიღებისას"
                      : m === "INSTALLMENT"
                        ? "ოპერატორი დაგიკავშირდებათ დასადასტურებლად"
                        : "უსაფრთხო გადახდა ბანკის გვერდზე"
                }
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="card p-5">
          <legend className="px-1 font-semibold">კომენტარი</legend>
          <textarea
            name="comment"
            rows={3}
            placeholder="დამატებითი ინფორმაცია შეკვეთაზე"
            className="mt-4 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          />
        </fieldset>
      </div>

      <aside className="card h-fit p-5 lg:sticky lg:top-24">
        <h2 className="mb-4 font-semibold">თქვენი შეკვეთა</h2>
        <ul className="max-h-64 space-y-3 overflow-y-auto text-sm">
          {(quote?.lines ?? lines.map((l) => ({
            productId: l.productId, name: l.name, qty: l.qty,
            lineTotal: l.price * l.qty, overStock: null as number | null,
          }))).map((l) => (
            <li key={l.productId} className="flex justify-between gap-3">
              <span className="flex-1 leading-tight">
                {l.name}
                <span className="text-muted"> × {l.qty}</span>
                {l.overStock !== null && (
                  <span className="mt-1 block text-xs text-brand-600">
                    საწყობში მხოლოდ {l.overStock} ცალია — დარჩენილს შეკვეთით მიიღებ
                  </span>
                )}
              </span>
              <span className="shrink-0 font-medium">{gel(l.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">პროდუქტები</dt>
            <dd>{gel(shownSubtotal)}</dd>
          </div>
          {quote && quote.saved > 0 && (
            <div className="flex justify-between text-brand-600">
              <dt>ფასდაკლება{quote.isDealer ? " (სადილერო)" : ""}</dt>
              <dd>−{gel(quote.saved)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">მიწოდება</dt>
            <dd>{deliveryFee === 0 ? "უფასო" : gel(deliveryFee)}</dd>
          </div>
          {quote && quote.weightKg > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">წონა</dt>
              <dd>{quote.weightKg} კგ</dd>
            </div>
          )}
          {quote && quote.volumeM3 > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">მოცულობა</dt>
              <dd>{quote.volumeM3} მ³</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 flex justify-between border-t border-line pt-4 text-lg font-bold">
          <span>ჯამი</span>
          <span>{gel(total)}</span>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary mt-5 w-full hover:bg-brand-600 disabled:opacity-60"
        >
          {busy ? "მუშავდება..." : paymentMethod === "BOG" ? "გადახდაზე გადასვლა" : "შეკვეთის დადასტურება"}
        </button>
      </aside>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  placeholder,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-brand-500">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Radio({
  checked,
  onChange,
  title,
  desc,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  desc: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
        checked ? "border-brand-500 bg-brand-50" : "border-line hover:border-brand-200"
      }`}
    >
      <input type="radio" checked={checked} onChange={onChange} className="mt-0.5 size-4 accent-brand-500" />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted">{desc}</span>
      </span>
    </label>
  );
}
