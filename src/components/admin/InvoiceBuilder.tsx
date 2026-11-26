"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInvoice, searchForInvoice, type InvoiceProduct } from "@/app/admin/invoices/actions";
import { createSale } from "@/app/admin/sales/actions";
import {
  DELIVERY_CITIES, DELIVERY_FEE, DELIVERY_FEE_BULKY, DELIVERY_FEE_BULKY_REGIONS, DELIVERY_FEE_REGIONS, FREE_DELIVERY_FROM, deliveryFeeFor,
} from "@/lib/constants";
import { gel } from "@/lib/format";

type Line = { product: InvoiceProduct; qty: number };
/** საიტზე არარსებული ნივთი — მხოლოდ მაღაზიის გაყიდვაში */
type Custom = { key: number; name: string; price: string; qty: string };

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500";
const star = <span className="text-brand-500">*</span>;

/** რაოდენობა პროდუქტის წესში: მინიმუმი, ბიჯი (შეკვრა), მარაგში მყოფზე — ნაშთამდე */
function fit(p: InvoiceProduct, qty: number): number {
  const min = Math.max(1, p.minQty);
  const step = Math.max(1, p.qtyStep);
  let q = Math.max(min, Math.round(qty) || min);
  q = min + Math.ceil((q - min) / step) * step;
  if (p.inStock && q > p.available) q = min + Math.floor((p.available - min) / step) * step;
  return Math.max(min, q);
}

const money = (s: string) => {
  const n = Number(s.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};

/**
 * ორი რეჟიმი ერთი ფორმით:
 *   invoice — ინვოისის გამოწერა (გადარიცხვა, მიწოდების არჩევანი, სურვილით ელფოსტაზე);
 *   store   — მაღაზიის გაყიდვა: ნივთი საიტიდან ან ხელით ჩაწერილი, მყიდველი (ფიზიკური პირი ან
 *             კომპანია), მისამართი და შენიშვნა. ინახება „მომზადებულად“; „გაიყიდა“ სიიდან.
 * საიტის ნივთის ფასი აქ არ იცვლება; თანხასა და ნაშთს სერვერი თავიდან ამოწმებს.
 */
export default function InvoiceBuilder({ mode = "invoice" }: { mode?: "invoice" | "store" }) {
  const store = mode === "store";
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<InvoiceProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [customs, setCustoms] = useState<Custom[]>([]);
  const [isCompany, setIsCompany] = useState(!store);
  const [delivery, setDelivery] = useState<"PICKUP" | "COURIER">("PICKUP");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);
  const customKey = useRef(0);

  // ძებნა აკრეფისას, მცირე დაყოვნებით; ძველი პასუხი ახალს არ გადაფარავს
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const id = ++seq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchForInvoice(query);
        if (id === seq.current) setResults(rows);
      } finally {
        if (id === seq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const add = (p: InvoiceProduct) =>
    setLines((ls) =>
      ls.some((l) => l.product.id === p.id)
        ? ls.map((l) => (l.product.id === p.id ? { ...l, qty: fit(p, l.qty + Math.max(1, p.qtyStep)) } : l))
        : [...ls, { product: p, qty: fit(p, p.minQty) }]
    );
  const setQty = (id: string, qty: number) =>
    setLines((ls) => ls.map((l) => (l.product.id === id ? { ...l, qty: fit(l.product, qty) } : l)));
  const remove = (id: string) => setLines((ls) => ls.filter((l) => l.product.id !== id));

  const addCustom = () => setCustoms((cs) => [...cs, { key: ++customKey.current, name: "", price: "", qty: "1" }]);
  const editCustom = (key: number, patch: Partial<Custom>) =>
    setCustoms((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const removeCustom = (key: number) => setCustoms((cs) => cs.filter((c) => c.key !== key));
  const customQty = (c: Custom) => Math.max(1, Math.floor(Number(c.qty)) || 1);

  const subtotal =
    Math.round(
      (lines.reduce((s, l) => s + l.product.price * l.qty, 0) + customs.reduce((s, c) => s + money(c.price) * customQty(c), 0)) * 100
    ) / 100;
  // მაღაზიის გაყიდვაში მიწოდება არ ითვლება — მისამართი მხოლოდ ჩანაწერისთვისაა
  // მსხვილ ტექნიკაზე მიწოდება თანხის მიუხედავად ფასიანია (40 / 80 ₾)
  const bulky = lines.some((l) => l.product.bulkyDelivery);
  const freeDelivery = !bulky && subtotal >= FREE_DELIVERY_FROM;
  const feeKnown = store || delivery === "PICKUP" || city !== "" || freeDelivery;
  const fee = store ? 0 : feeKnown ? deliveryFeeFor(delivery, city, subtotal, bulky) : null;
  const total = Math.round((subtotal + (fee ?? 0)) * 100) / 100;
  const count = lines.reduce((s, l) => s + l.qty, 0) + customs.reduce((s, c) => s + customQty(c), 0);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!lines.length && !customs.length) return setError("აირჩიე ერთი პროდუქტი მაინც");
    const badCustom = customs.find((c) => c.name.trim().length < 2 || !money(c.price));
    if (badCustom) return setError("სხვა ნივთს დასახელება და ფასი სჭირდება");
    if (!store && delivery === "COURIER" && !city) return setError("აირჩიე ქალაქი");
    const fd = new FormData(e.currentTarget);
    const text = (k: string) => String(fd.get(k) ?? "").trim();
    const companyName = isCompany ? text("companyName") : "";
    // მაღაზიაში სახელი და გვარი ცალ-ცალკე იწერება; კომპანიაზე საკონტაქტო პირი არასავალდებულოა
    const person = store ? [text("firstName"), text("lastName")].filter(Boolean).join(" ") : text("customerName");
    const items = lines.map((l) => ({ productId: l.product.id, qty: l.qty }));

    start(async () => {
      if (store) {
        const r = await createSale({
          customerName: person || companyName,
          customerPhone: text("customerPhone"),
          customerId: text("customerId"),
          companyName,
          // მაღაზიიდან მიაქვს მყიდველს; მისამართი ჩანაწერში რჩება
          deliveryMethod: "PICKUP",
          deliveryAddress: text("address"),
          comment: [text("address") ? `მისამართი: ${text("address")}` : "", text("comment")].filter(Boolean).join("\n"),
          items,
          customItems: customs.map((c) => ({ name: c.name.trim(), price: money(c.price), qty: customQty(c) })),
        });
        if (!r.ok) return setError(r.error);
        router.push(`/admin/sales?ok=${encodeURIComponent(`${r.number} მომზადებულია — ფულის მიღებისას დააჭირე „გაიყიდა“`)}`);
        return;
      }
      const r = await createInvoice({
        customerName: person,
        customerPhone: text("customerPhone"),
        customerEmail: email.trim(),
        customerId: text("customerId"),
        companyName,
        deliveryMethod: delivery,
        deliveryCity: delivery === "COURIER" ? city : "",
        deliveryAddress: delivery === "COURIER" ? text("deliveryAddress") : "",
        comment: text("comment"),
        sendEmail: sendEmail && email.trim() !== "",
        items,
      });
      if (!r.ok) return setError(r.error);
      // შეკვეთის გვერდზე ინვოისის ბმულია (გახსნა / ბეჭდვა); წერილი თუ ვერ წავიდა — იქვე ეწერება
      const note = r.emailError ? `?mail=${encodeURIComponent(r.emailError)}` : r.emailed ? "?mail=ok" : "";
      router.push(`/admin/orders/${r.orderId}${note}`);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-5">
        <section className="card p-5">
          <h2 className="font-semibold">1. პროდუქტები</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder="ძებნა საიტის პროდუქტებში: დასახელება, კოდი ან მოდელი"
            className={`${field} mt-3`}
          />
          {q.trim().length >= 2 && (
            <div className="mt-2 max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line">
              {results.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2.5 text-sm">
                  <span className="size-10 shrink-0 overflow-hidden rounded bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element -- პატარა წინასწარი ნახვა */}
                    {p.image && <img src={p.image} alt="" className="size-10 object-contain" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block text-xs text-muted">
                      <span className="font-mono">{p.sku}</span> · {p.stockLabel}
                      {p.inStock ? ` (${p.available})` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums">{p.price > 0 ? gel(p.price) : "—"}</span>
                  </span>
                  {p.blocked ? (
                    <span className="w-24 shrink-0 text-right text-xs text-muted">{p.blocked}</span>
                  ) : (
                    <button type="button" onClick={() => add(p)} className="btn btn-outline w-24 shrink-0 px-2 py-1.5 text-xs">
                      {lines.some((l) => l.product.id === p.id) ? "+ კიდევ" : "დამატება"}
                    </button>
                  )}
                </div>
              ))}
              {!results.length && (
                <p className="p-4 text-center text-sm text-muted">{searching ? "იძებნება…" : "ვერაფერი მოიძებნა."}</p>
              )}
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">{store ? "გაყიდვაში" : "ინვოისში"}</th>
                  <th className="px-3 py-2 text-right font-medium">ფასი</th>
                  <th className="px-3 py-2 font-medium">რაოდენობა</th>
                  <th className="px-3 py-2 text-right font-medium">ჯამი</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.map((l) => (
                  <tr key={l.product.id}>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium">{l.product.name}</div>
                      <div className="text-xs text-muted">
                        <span className="font-mono">{l.product.sku}</span>
                        {l.product.inStock ? ` · მარაგში ${l.product.available}` : ` · ${l.product.stockLabel}`}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{gel(l.product.price)}</td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min={l.product.minQty}
                        step={l.product.qtyStep}
                        max={l.product.inStock ? l.product.available : undefined}
                        value={l.qty}
                        onChange={(e) => setQty(l.product.id, Number(e.target.value))}
                        aria-label="რაოდენობა"
                        className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm outline-none focus:border-brand-500"
                      />
                      {l.product.unit && <span className="ml-1 text-xs text-muted">{l.product.unit}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums">{gel(l.product.price * l.qty)}</td>
                    <td className="py-2.5 pl-2 text-right">
                      <button type="button" onClick={() => remove(l.product.id)} aria-label="წაშლა" className="rounded px-2 py-1 text-muted hover:bg-canvas hover:text-rose-600">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {customs.map((c) => (
                  <tr key={`c${c.key}`}>
                    <td className="py-2.5 pr-3">
                      <input
                        value={c.name}
                        onChange={(e) => editCustom(c.key, { name: e.target.value })}
                        placeholder="ნივთის დასახელება"
                        maxLength={200}
                        aria-label="სხვა ნივთის დასახელება"
                        className="w-full min-w-48 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
                      />
                      <div className="mt-0.5 text-xs text-muted">სხვა ნივთი — საიტზე არ არის, ნაშთს არ ეხება</div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        value={c.price}
                        onChange={(e) => editCustom(c.key, { price: e.target.value })}
                        inputMode="decimal"
                        placeholder="ფასი ₾"
                        aria-label="სხვა ნივთის ფასი"
                        className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-right text-sm outline-none focus:border-brand-500"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min={1}
                        value={c.qty}
                        onChange={(e) => editCustom(c.key, { qty: e.target.value })}
                        aria-label="რაოდენობა"
                        className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm outline-none focus:border-brand-500"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums">{gel(money(c.price) * customQty(c))}</td>
                    <td className="py-2.5 pl-2 text-right">
                      <button type="button" onClick={() => removeCustom(c.key)} aria-label="წაშლა" className="rounded px-2 py-1 text-muted hover:bg-canvas hover:text-rose-600">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {!lines.length && !customs.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted">ჯერ არაფერია არჩეული — მოძებნე და დაამატე.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {store && (
            <button type="button" onClick={addCustom} className="btn btn-outline mt-3 px-3 py-2 text-sm">
              + სხვა ნივთი (საიტზე არ არის)
            </button>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">2. მყიდველი</h2>
          {store ? (
            <>
              <div className="mt-3 flex flex-wrap gap-3">
                {[false, true].map((company) => (
                  <label
                    key={String(company)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm ${
                      isCompany === company ? "border-brand-500 bg-brand-50" : "border-line hover:border-brand-200"
                    }`}
                  >
                    <input type="radio" checked={isCompany === company} onChange={() => setIsCompany(company)} className="size-4 accent-brand-500" />
                    {company ? "კომპანია" : "ფიზიკური პირი"}
                  </label>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {isCompany && (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">კომპანიის დასახელება {star}</span>
                      <input name="companyName" required minLength={2} className={field} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">საიდენტიფიკაციო კოდი</span>
                      <input name="customerId" maxLength={20} className={field} />
                    </label>
                  </>
                )}
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">სახელი {!isCompany && star}</span>
                  <input name="firstName" required={!isCompany} className={field} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">გვარი {!isCompany && star}</span>
                  <input name="lastName" required={!isCompany} className={field} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium">მისამართი</span>
                  <input name="address" maxLength={280} className={field} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">ტელეფონი</span>
                  <input name="customerPhone" type="tel" placeholder="5XX XX XX XX" maxLength={40} className={field} />
                </label>
              </div>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-medium">შენიშვნა</span>
                <textarea name="comment" rows={3} maxLength={500} className={field} />
              </label>
            </>
          ) : (
            <>
              <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm">
                <input type="checkbox" checked={isCompany} onChange={(e) => setIsCompany(e.target.checked)} className="size-4 accent-brand-500" />
                იურიდიული პირი
              </label>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {isCompany && (
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium">კომპანიის დასახელება {star}</span>
                    <input name="companyName" required className={field} />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">{isCompany ? "საიდენტიფიკაციო კოდი" : "პირადი ნომერი"}</span>
                  <input name="customerId" maxLength={20} className={field} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">{isCompany ? "საკონტაქტო პირი" : "სახელი და გვარი"} {star}</span>
                  <input name="customerName" required minLength={2} className={field} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">ტელეფონი {star}</span>
                  <input name="customerPhone" type="tel" required minLength={9} placeholder="5XX XX XX XX" className={field} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">ელფოსტა</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
                </label>
              </div>
              <label className={`mt-3 flex items-center gap-2.5 text-sm ${email.trim() ? "cursor-pointer" : "text-muted"}`}>
                <input
                  type="checkbox"
                  checked={sendEmail && email.trim() !== ""}
                  disabled={!email.trim()}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="size-4 accent-brand-500"
                />
                ინვოისი მაშინვე გაეგზავნოს მყიდველს ელფოსტაზე
              </label>
            </>
          )}
        </section>

        {!store && (
          <section className="card p-5">
            <h2 className="font-semibold">3. მიწოდება</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(["PICKUP", "COURIER"] as const).map((m) => (
                <label
                  key={m}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-sm ${
                    delivery === m ? "border-brand-500 bg-brand-50" : "border-line hover:border-brand-200"
                  }`}
                >
                  <input type="radio" checked={delivery === m} onChange={() => setDelivery(m)} className="mt-0.5 size-4 accent-brand-500" />
                  <span>
                    <span className="block font-medium">{m === "PICKUP" ? "საწყობიდან გატანა" : "ადგილზე მიტანა"}</span>
                    <span className="block text-xs text-muted">
                      {m === "PICKUP"
                        ? "უფასო"
                        : freeDelivery
                          ? "უფასო"
                          : bulky
                            ? `მსხვილი ტექნიკა: თბილისი — ${DELIVERY_FEE_BULKY}₾, სხვა ქალაქები — ${DELIVERY_FEE_BULKY_REGIONS}₾`
                            : `თბილისი — ${DELIVERY_FEE}₾, სხვა ქალაქები — ${DELIVERY_FEE_REGIONS}₾`}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {delivery === "COURIER" && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">ქალაქი {star}</span>
                  <select value={city} onChange={(e) => setCity(e.target.value)} className={field}>
                    <option value="" disabled>აირჩიე ქალაქი</option>
                    {DELIVERY_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">მისამართი {star}</span>
                  <input name="deliveryAddress" required maxLength={300} className={field} />
                </label>
              </div>
            )}
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium">კომენტარი</span>
              <textarea name="comment" rows={2} maxLength={800} className={field} />
            </label>
          </section>
        )}
      </div>

      <aside className="card h-fit p-5 lg:sticky lg:top-6">
        <h2 className="mb-3 font-semibold">ჯამი</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">პროდუქტები ({count})</dt>
            <dd className="tabular-nums">{gel(subtotal)}</dd>
          </div>
          {!store && (
            <div className="flex justify-between">
              <dt className="text-muted">მიწოდება</dt>
              <dd className="tabular-nums">{fee === null ? "—" : fee === 0 ? "უფასო" : gel(fee)}</dd>
            </div>
          )}
        </dl>
        <div className="mt-3 flex justify-between border-t border-line pt-3 text-lg font-bold">
          <span>სულ</span>
          <span className="tabular-nums">{gel(total)}</span>
        </div>
        <p className="mt-2 text-xs text-muted">
          {store
            ? "ინახება „მომზადებულად“. ნაშთი ჩამოიწერება მაშინ, როცა სიაში „გაიყიდა“-ს დააჭერ."
            : "გადახდა: საბანკო გადარიცხვა. ფასები საიტისაა (დღგ-ის ჩათვლით)."}
        </p>

        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

        <button type="submit" disabled={pending || (!lines.length && !customs.length)} className="btn btn-primary mt-4 w-full hover:bg-brand-600 disabled:opacity-60">
          {pending ? "ინახება…" : store ? "გაყიდვის მომზადება" : "ინვოისის გამოწერა"}
        </button>
      </aside>
    </form>
  );
}
