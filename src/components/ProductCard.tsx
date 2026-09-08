import Image from "next/image";
import Link from "next/link";
import { gel } from "@/lib/format";
import { stockLabel } from "@/lib/stock";
import { effectivePrice, type Viewer } from "@/lib/pricing";

export type CardProduct = {
  id: string;
  sku: string;
  slug: string;
  nameKa: string;
  model: string | null;
  price: number;
  dealerPrice?: number | null;
  oldPrice: number | null;
  stockQty: number;
  stockStatus: string;
  incomingDate: Date | null;
  lowStockAt: number;
  isNew: boolean;
  images: { url: string; alt: string | null }[];
  brand: { name: string; slug: string } | null;
};

const TONE = {
  ok: "text-ok",
  low: "text-amber-600",
  transit: "text-sky-600",
  none: "text-muted",
} as const;

export default function ProductCard({ p, viewer }: { p: CardProduct; viewer?: Viewer }) {
  const stock = stockLabel(p);
  const price = effectivePrice(p, viewer ?? null);

  // ბეჯი ეყრდნობა ან ძველ ფასს, ან მომხმარებლის დონეს
  const listDiscount =
    p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : null;
  const discount = listDiscount ?? (price.saved > 0 ? Math.round(price.savedPercent) : null);

  return (
    <Link
      href={`/product/${p.slug}`}
      className="card group flex flex-col overflow-hidden transition hover:border-brand-200 hover:shadow-md"
    >
      <div className="relative aspect-square bg-white p-4">
        {p.images[0] ? (
          <Image
            src={p.images[0].url}
            alt={p.images[0].alt ?? p.nameKa}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain p-4 transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            სურათი არ არის
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-col gap-1">
          {discount ? (
            <span className="rounded bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white">
              -{discount}%
            </span>
          ) : null}
          {p.isNew && (
            <span className="rounded bg-brand-500 px-2 py-0.5 text-[11px] font-bold text-white">
              ახალი
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 border-t border-line p-4">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-ink group-hover:text-brand-600">
          {p.nameKa}
        </h3>
        {p.model && <div className="text-xs text-muted">{p.model}</div>}
        <div className="text-xs text-muted">#{p.sku}</div>

        <div className="mt-auto pt-2">
          {price.saved > 0 ? (
            /* დილერს ორივე ფასი უჩანს, როგორც ეტალონ საიტზე */
            <div className="space-y-0.5">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-muted">
                  {price.isDealer ? "სადილერო:" : "თქვენი ფასი:"}
                </span>
                <span className="text-lg font-bold text-brand-600">{gel(price.value)}</span>
              </div>
              <div className="flex items-baseline gap-2 text-xs text-muted">
                <span>საცალო:</span>
                <span className="line-through">{gel(price.retail)}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-ink">{gel(price.value)}</span>
              {p.oldPrice && p.oldPrice > p.price && (
                <span className="text-sm text-muted line-through">{gel(p.oldPrice)}</span>
              )}
            </div>
          )}

          <div className={`mt-1 text-xs font-medium ${TONE[stock.tone]}`}>{stock.text}</div>
        </div>
      </div>
    </Link>
  );
}
