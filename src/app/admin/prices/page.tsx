import { db } from "@/lib/db";
import { MAX_PARTNER_SHARE, TIERS } from "@/lib/pricing";
import { getTierShares } from "@/lib/pricing-settings";
import SupplierPricingRow from "@/components/admin/SupplierPricingRow";
import PricesTabs from "@/components/admin/PricesTabs";
import { repriceAllAction, saveTiersAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "პროდუქციის ფასები" };

const input =
  "w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand-500";

export default async function PricesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;

  const [suppliers, supplies, shares] = await Promise.all([
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.productSupply.findMany({ select: { supplierId: true, cost: true, listPrice: true } }),
    getTierShares(),
  ]);

  const stats = new Map<string, { products: number; withList: number; sample: { cost: number; list: number | null } | null }>();
  for (const s of supplies) {
    const st = stats.get(s.supplierId) ?? { products: 0, withList: 0, sample: null };
    st.products++;
    const two = s.listPrice != null && s.cost != null && s.listPrice > s.cost;
    if (two) st.withList++;
    if (s.cost && s.cost > 0 && (!st.sample || (two && st.sample.list == null))) {
      st.sample = { cost: s.cost, list: two ? s.listPrice : null };
    }
    stats.set(s.supplierId, st);
  }

  // საფეხურების მაგალითი: მისი საცალო 1000, ქოსთი 800 → M = 200
  const EX_LIST = 1000;
  const EX_COST = 800;
  const partners = TIERS.filter((t) => t.code !== "RETAIL");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">პროდუქციის ფასები</h1>
        <p className="mt-1 text-sm text-muted">ფასები მხოლოდ აქედან იცვლება — მიმწოდებლის წესი, პარტნიორების საფეხურები და ცალკეული პროდუქტი.</p>
      </div>

      <PricesTabs active="rules" />

      {ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{ok}</p>}
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <section className="card p-5 text-sm">
        <h2 className="mb-2 font-semibold">როგორ ითვლება</h2>
        <pre className="overflow-x-auto rounded-lg bg-canvas p-3 text-xs leading-6">{`M = მიმწოდებლის საცალო − ქოსთი          (ორი ფასი API-დან)

საცალო    = მისი საცალო − ${"N"}% × M            („% მოგებიდან“, N — მიმწოდებლის რიგში)
საფეხური  = მისი საცალო − წილი × M           (წილები ქვემოთ, საფეხურებში)

ერთი ფასი თუ მოდის (ფაილი, რომსატი): ბაზა ჩვენი საცალოა, M = ჩვენი საცალო − ქოსთი.
ფასი თვითღირებულებაზე დაბლა არასდროს ჩამოდის; პარტნიორს მოგების ${Math.round((1 - MAX_PARTNER_SHARE) * 100)}% ყოველთვის ჩვენთან რჩება.`}</pre>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <h2 className="font-semibold">მიმწოდებლები</h2>
          <form action={repriceAllAction}>
            <button className="btn btn-outline px-3 py-1.5 text-xs">ყველას გადათვლა</button>
          </form>
        </div>
        {suppliers.map((s) => (
          <SupplierPricingRow
            key={s.id}
            supplier={{
              id: s.id,
              name: s.name,
              retailBase: s.retailBase,
              markupRetail: s.markupRetail,
              supplierDiscount: s.supplierDiscount,
              minMargin: s.minMargin,
            }}
            stats={stats.get(s.id) ?? { products: 0, withList: 0, sample: null }}
          />
        ))}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">პარტნიორების საფეხურები</h2>
        <p className="mt-1 text-sm text-muted">
          რამდენ პროცენტს იღებს თითოეული საფეხური მოგებიდან (M). მაქსიმუმ {Math.round(MAX_PARTNER_SHARE * 100)}%.
          დონეს მომხმარებელს „მომხმარებლების“ გვერდზე ანიჭებ.
        </p>

        <form action={saveTiersAction} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {partners.map((t) => (
              <label key={t.code} className="block">
                <span className="mb-1 block text-xs text-muted">{t.label} — % მოგებიდან</span>
                <input
                  name={t.code}
                  defaultValue={Math.round((shares[t.code] ?? t.share) * 1000) / 10}
                  inputMode="decimal"
                  className={input}
                />
              </label>
            ))}
          </div>
          <button className="btn btn-primary px-4 py-2 text-sm">საფეხურების შენახვა</button>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-1.5 pr-4 font-medium">მაგალითი: მისი საცალო {EX_LIST}₾, ქოსთი {EX_COST}₾</th>
                {partners.map((t) => (
                  <th key={t.code} className="py-1.5 pr-4 text-right font-medium">{t.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <td className="py-1.5 pr-4 text-muted">პარტნიორის ფასი</td>
                {partners.map((t) => (
                  <td key={t.code} className="py-1.5 pr-4 text-right tabular-nums">
                    {(EX_LIST - (shares[t.code] ?? t.share) * (EX_LIST - EX_COST)).toFixed(2)}₾
                  </td>
                ))}
              </tr>
              <tr className="border-t border-line">
                <td className="py-1.5 pr-4 text-muted">ჩვენ გვრჩება</td>
                {partners.map((t) => (
                  <td key={t.code} className="py-1.5 pr-4 text-right tabular-nums">
                    {((1 - (shares[t.code] ?? t.share)) * (EX_LIST - EX_COST)).toFixed(2)}₾
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
