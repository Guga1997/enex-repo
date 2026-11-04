"use client";

import { useEffect, useState, useTransition } from "react";
import { saveOwnStock } from "@/app/admin/inventory/actions";

/** „ჩემი მარაგი“ სტრიქონშივე: −/+ ან ციფრი, შენახვა ღილაკით ან Enter-ით */
export default function StockControl({ productId, qty }: { productId: string; qty: number }) {
  const [value, setValue] = useState(String(qty));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => setValue(String(qty)), [qty]);

  const target = Number(value);
  const valid = value !== "" && Number.isInteger(target) && target >= 0;
  const delta = valid ? target - qty : 0;
  const dirty = value !== String(qty);

  const save = () => {
    if (!valid || !delta || pending) return;
    setError("");
    start(async () => {
      const r = await saveOwnStock(productId, target, note);
      if (r.error) setError(r.error);
      else setNote("");
    });
  };
  const step = (by: number) => setValue(String(Math.max(0, (valid ? target : qty) + by)));
  const btn = "flex size-8 items-center justify-center rounded-lg border border-line text-base hover:bg-canvas disabled:opacity-40";

  return (
    <div className="min-w-44 space-y-1.5">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="მოკლება" onClick={() => step(-1)} disabled={pending || (valid && target <= 0)} className={btn}>−</button>
        <input
          type="number"
          min={0}
          step={1}
          value={value}
          aria-label="ჩემი მარაგი"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setValue(String(qty));
          }}
          className={`w-16 rounded-lg border bg-surface px-1 py-1.5 text-center text-sm outline-none focus:border-brand-500 ${valid ? "border-line" : "border-rose-400"}`}
        />
        <button type="button" aria-label="დამატება" onClick={() => step(1)} disabled={pending} className={btn}>+</button>
        {valid && delta !== 0 && (
          <span className={`ml-1 text-xs font-semibold ${delta > 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
      {dirty && (
        <div className="flex items-center gap-1">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="მიზეზი (არასავალდებულო)"
            maxLength={200}
            className="w-32 rounded-lg border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-brand-500"
          />
          <button type="button" onClick={save} disabled={pending || !valid || !delta} className="rounded-lg bg-brand-500 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {pending ? "…" : "შენახვა"}
          </button>
          <button type="button" onClick={() => setValue(String(qty))} disabled={pending} className="px-1 text-xs text-muted hover:text-ink">გაუქმება</button>
        </div>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
