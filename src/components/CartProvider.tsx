"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartLine = {
  productId: string;
  sku: string;
  name: string;
  slug: string;
  price: number;
  image?: string;
  qty: number;
  maxQty: number; // 0 = ლიმიტის გარეშე (წინასწარი შეკვეთა / გზაშია)
};

type CartCtx = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  ready: boolean;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* localStorage მიუწვდომელია — კალათა ცარიელი რჩება */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* კვოტა ან privacy რეჟიმი — ვაგრძელებთ მეხსიერებაში */
    }
  }, [lines, ready]);

  const value = useMemo<CartCtx>(() => {
    const cap = (l: CartLine, qty: number) =>
      l.maxQty > 0 ? Math.min(qty, l.maxQty) : qty;

    return {
      lines,
      ready,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: lines.reduce((s, l) => s + l.qty * l.price, 0),
      add: (line, qty = 1) =>
        setLines((prev) => {
          const existing = prev.find((l) => l.productId === line.productId);
          if (existing) {
            return prev.map((l) =>
              l.productId === line.productId ? { ...l, qty: cap(l, l.qty + qty) } : l
            );
          }
          return [...prev, { ...line, qty: cap({ ...line, qty }, qty) }];
        }),
      setQty: (productId, qty) =>
        setLines((prev) =>
          prev
            .map((l) => (l.productId === productId ? { ...l, qty: cap(l, Math.max(0, qty)) } : l))
            .filter((l) => l.qty > 0)
        ),
      remove: (productId) => setLines((prev) => prev.filter((l) => l.productId !== productId)),
      clear: () => setLines([]),
    };
  }, [lines, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart უნდა გამოიყენებოდეს CartProvider-ის შიგნით");
  return ctx;
}
