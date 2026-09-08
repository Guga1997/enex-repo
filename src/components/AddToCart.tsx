"use client";

import { useState } from "react";
import { useCart, type CartLine } from "./CartProvider";

type Props = { line: Omit<CartLine, "qty">; disabled?: boolean; withQty?: boolean };

export default function AddToCart({ line, disabled, withQty }: Props) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);

  if (disabled) {
    return (
      <button disabled className="btn w-full cursor-not-allowed bg-canvas text-muted">
        არ არის მარაგში
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      {withQty && (
        <div className="flex items-center rounded-lg border border-line">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-3 py-2.5 text-muted hover:text-ink"
            aria-label="შემცირება"
          >
            −
          </button>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className="w-12 border-x border-line py-2.5 text-center text-sm outline-none"
          />
          <button
            onClick={() => setQty((q) => q + 1)}
            className="px-3 py-2.5 text-muted hover:text-ink"
            aria-label="გაზრდა"
          >
            +
          </button>
        </div>
      )}
      <button
        onClick={() => {
          add(line, qty);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        }}
        className="btn btn-primary flex-1 hover:bg-brand-600"
      >
        {done ? "✓ დაემატა კალათაში" : "კალათაში დამატება"}
      </button>
    </div>
  );
}
