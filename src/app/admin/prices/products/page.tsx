import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ci } from "@/lib/search-mode";
import { effectivePrice, TIERS } from "@/lib/pricing";
import { getTierShares } from "@/lib/pricing-settings";
import PricesTabs from "@/components/admin/PricesTabs";
import { saveProductPriceAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "პროდუქტების ფასები" };

const PER_PAGE = 40;
const input =
  "w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm tabular-nums outline-none focus:border-brand-500";

const FILTERS: Record<string, { label: string; where: Prisma.ProductWhereInput }> = {
  all: { label: "ყველა", where: {} },
  locked: { label: "ხელით დაწერილი", where: { priceLocked: true } },
  own: { label: "მიმწოდებლის გარეშე", where: { supplies: { none: {} } } },
  sale: { label: "ძველი ფასით (ფასდაკლება)", where: { oldPrice: { not: null } } },
};

const money = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(2)}₾`);

export default async function ProductPricesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string; page?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const f = sp.f && FILTERS[sp.f] ? sp.f : "all";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ProductWhereInput = {
    AND: [
      FILTERS[f].where,
      q ? { OR: [{ sku: ci(q) }, { nameKa: ci(q) }, { model: ci(q) }] } : {},
    ],
  };

  const [products, total, shares] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { nameKa: "asc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, sku: true, nameKa: true, isActive: true,
        price: true, cost: true, listPrice: true, oldPrice: true, priceLocked: true, dealerPrice: true,
        supplies: { select: { supplier: { select: { name: true } } } },
      },
    }),
    db.product.count({ where }),
    getTierShares(),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(f !== "all" ? { f } : {}), ...(page > 1 ? { page: String(page) } : {}), ...over });
    return `/admin/prices/products?${p}`;
  };
  const here = qs({});
  const dealer = TIERS.find((t) => t.code === "DEALER")!;
  const top = TIERS.find((t) => t.code === "PLATINUM")!;
  const at = (p: (typeof products)[number], code: string) =>
    effectivePrice(p, { priceTier: code, discountPercent: 0, share: shares[code] }).value;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">პროდუქციის ფასები</h1>
        <p className="mt-1 text-sm text-muted">
          ცალკეული პროდუქტი. „ხელით“ მონიშნულზე შენი ფასი იკეტება და სინქი მას აღარ ცვლის; მონიშვნის მოხსნისას ფასი ისევ ფორმულით ითვლება.
        </p>
      </div>

      <PricesTabs active="products" />

      {sp.ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{sp.ok}</p>}
      {sp.error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{sp.error}</p>}

      <form className="card flex flex-wrap items-end gap-3 p-4">
        <label className="block min-w-56 flex-1">
          <span className="mb-1 block text-xs text-muted">ძებნა</span>
          <input name="q" defaultValue={q} placeholder="კოდი, დასახელება ან მოდელი" className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">ფილტრი</span>
          <select name="f" defaultValue={f} className={input}>
            {Object.entries(FILTERS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
        <button className="btn btn-outline px-4 py-2 text-sm">ჩვენება</button>
        <span className="ml-auto text-sm text-muted">{total} პროდუქტი</span>
      </form>

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[2.2fr_0.8fr_0.8fr_1.1fr_1fr_0.9fr_0.9fr_auto] gap-3 border-b border-line bg-canvas px-4 py-2 text-xs text-muted lg:grid">
          <span>პროდუქტი</span>
          <span className="text-right">ქოსთი</span>
          <span className="text-right">მისი საცალო</span>
          <span className="text-right">{dealer.label} / {top.label}</span>
          <span>ჩვენი ფასი</span>
          <span>ძველი ფასი</span>
          <span>ქოსთი (ხელით)</span>
          <span />
        </div>

        {products.length === 0 && <p className="p-8 text-center text-muted">ვერაფერი მოიძებნა</p>}

        {products.map((p) => {
          const supplied = p.supplies.length > 0;
          return (
            <form
              key={p.id}
              action={saveProductPriceAction}
              className="grid gap-3 border-b border-line px-4 py-3 last:border-0 lg:grid-cols-[2.2fr_0.8fr_0.8fr_1.1fr_1fr_0.9fr_0.9fr_auto] lg:items-center"
            >
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="return" value={here} />

              <div className="min-w-0">
                <Link href={`/admin/products/${p.id}`} className="block truncate text-sm font-medium hover:text-brand-600">
                  {p.nameKa}
                </Link>
                <div className="truncate text-xs text-muted">
                  {p.sku} · {supplied ? p.supplies.map((s) => s.supplier.name).join(", ") : "მიმწოდებლის გარეშე"}
                  {!p.isActive && " · დამალული"}
                </div>
              </div>

              <div className="text-right text-sm tabular-nums">{money(p.cost)}</div>
              <div className="text-right text-sm tabular-nums text-muted">{money(p.listPrice)}</div>
              <div className="text-right text-xs tabular-nums text-muted">
                {p.cost ? `${at(p, "DEALER").toFixed(2)} / ${at(p, "PLATINUM").toFixed(2)}` : "—"}
              </div>

              <div className="flex items-center gap-2">
                <input name="price" defaultValue={p.price.toFixed(2)} inputMode="decimal" className={input} aria-label="ჩვენი ფასი" />
                {supplied && (
                  <label className="flex items-center gap-1 whitespace-nowrap text-xs text-muted" title="ჩაწერილი ფასი იკეტება — სინქი აღარ შეცვლის">
                    <input type="checkbox" name="manual" defaultChecked={p.priceLocked} className="size-3.5 accent-brand-500" />
                    ხელით
                  </label>
                )}
              </div>

              <input name="oldPrice" defaultValue={p.oldPrice?.toFixed(2) ?? ""} placeholder="—" inputMode="decimal" className={input} aria-label="ძველი ფასი" />

              {supplied ? (
                <span className="text-xs text-muted">მიმწოდებლიდან</span>
              ) : (
                <input name="cost" defaultValue={p.cost?.toFixed(2) ?? ""} placeholder="—" inputMode="decimal" className={input} aria-label="ქოსთი" />
              )}

              <button className="btn btn-outline px-3 py-1.5 text-xs">შენახვა</button>
            </form>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn btn-outline">←</Link>}
          <span className="px-3 py-2 text-sm text-muted">{page} / {pages}</span>
          {page < pages && <Link href={qs({ page: String(page + 1) })} className="btn btn-outline">→</Link>}
        </div>
      )}
    </div>
  );
}
