"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/LocaleProvider";

export default function SearchBox() {
  const t = useT();
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/catalog?q=${encodeURIComponent(q.trim())}` : "/catalog");
      }}
      className="relative"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("ძებნა დასახელებით, მოდელით ან კოდით...")}
        className="w-full rounded-lg border border-line bg-canvas py-2.5 pl-4 pr-11 text-sm outline-none focus:border-brand-500 focus:bg-surface"
      />
      <button
        type="submit"
        aria-label={t("ძებნა")}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted hover:text-brand-600"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </form>
  );
}
