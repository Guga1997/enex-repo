"use client";

import Link from "@/components/Link";
import { useCart } from "./CartProvider";
import { useT } from "@/components/LocaleProvider";

export default function CartButton() {
  const t = useT();
  const { count } = useCart();
  return (
    <Link
      href="/cart"
      className="relative ml-1 flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3h2l2.4 12.1a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L21 7H6" />
        <circle cx="10" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </svg>
      <span className="hidden sm:inline">{t("კალათა")}</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
