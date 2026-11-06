"use client";

import { useState } from "react";
import { useCart, type CartLine } from "./CartProvider";
import { useT } from "@/components/LocaleProvider";
import { gel } from "@/lib/format";
import { normalizeQty } from "@/lib/stock";

type Props = { line: Omit<CartLine, "qty">; disabled?: boolean; withQty?: boolean };

export default function AddToCart({ line, disabled, withQty }: Props) {
  const t = useT();
  const { add } = useCart();
  const min = Math.max(1, line.minQty ?? 1);
  const step = Math.max(1, line.qtyStep ?? 1);
  const unit = line.unit ? t(line.unit) : "";
  const [qty, setQty] = useState(min);
  const [draft, setDraft] = useState(String(min));
  const [done, setDone] = useState(false);

  if (disabled) {
    return (
      <button disabled className="btn w-full cursor-not-allowed bg-canvas text-muted">
        {t("არ არის მარაგში")}
      </button>
    );
  }

  /** ციფრი ყოველთვის წესში ჯდება: მინიმუმი, შეკვრა, ნაშთი */
  const apply = (value: number) => {
    const q = normalizeQty(value, line, line.maxQty) || min;
    setQty(q);
    setDraft(String(q));
    return q;
  };

  return (
    <div className="space-y-2">
      {/* ფასი ერთეულზეა — მყიდველმა წინასწარ უნდა დაინახოს წესი და ჯამი */}
      {step > 1 ? (
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          {t("იყიდება მხოლოდ შეკვრით: {0} {1}", step, unit)} · {t("ერთი შეკვრა — {0}", gel(line.price * step))}
        </p>
      ) : (
        min > 1 && (
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            {t("მინიმალური შეკვეთა: {0} {1}", min, unit)}
          </p>
        )
      )}
      <div className="flex gap-2">
        {withQty && (
          <div className="flex items-center rounded-lg border border-line">
            <button
              onClick={() => apply(qty - step)}
              disabled={qty <= min}
              className="px-3 py-2.5 text-muted hover:text-ink disabled:opacity-30"
              aria-label={t("შემცირება")}
            >
              −
            </button>
            <input
              type="number"
              min={min}
              step={step}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => apply(Number(draft) || min)}
              onKeyDown={(e) => e.key === "Enter" && apply(Number(draft) || min)}
              className={`border-x border-line bg-transparent py-2.5 text-center text-sm outline-none ${line.unit ? "w-20" : "w-12"}`}
            />
            <button
              onClick={() => apply(qty + step)}
              className="px-3 py-2.5 text-muted hover:text-ink"
              aria-label={t("გაზრდა")}
            >
              +
            </button>
          </div>
        )}
        <button
          onClick={() => {
            add(line, apply(Number(draft) || min));
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          }}
          className="btn btn-primary flex-1 hover:bg-brand-600"
        >
          {done ? t("✓ დაემატა კალათაში") : t("კალათაში დამატება")}
        </button>
      </div>
      {line.unit && (
        <p className="text-sm text-muted">{t("სულ: {0} {1} — {2}", qty, unit, gel(line.price * qty))}</p>
      )}
    </div>
  );
}
