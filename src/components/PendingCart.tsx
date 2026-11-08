"use client";

import { useEffect } from "react";
import { PENDING_CART_KEY, useCart, type CartLine } from "./CartProvider";

/**
 * შეკვეთის გვერდზე: ბანკზე წასვლისას შენახული კალათა — გადახდა ჩავარდა ან ვადა გავიდა →
 * ბრუნდება კალათაში; გადახდილია → იშლება. სხვა შეკვეთის ასლს არ ეხება.
 */
export default function PendingCart({ orderId, outcome }: { orderId: string; outcome: "paid" | "lost" | "open" }) {
  const { restore, ready } = useCart();

  useEffect(() => {
    if (!ready || outcome === "open") return;
    try {
      const raw = localStorage.getItem(PENDING_CART_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { orderId?: string; lines?: CartLine[] };
      if (saved.orderId !== orderId) return;
      if (outcome === "lost" && Array.isArray(saved.lines)) restore(saved.lines);
      localStorage.removeItem(PENDING_CART_KEY);
    } catch {
      /* localStorage მიუწვდომელია */
    }
  }, [ready, outcome, orderId, restore]);

  return null;
}
