"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SORT_OPTIONS } from "@/lib/constants";

export default function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  return (
    <select
      aria-label="დალაგება"
      value={sp.get("sort") ?? "default"}
      onChange={(e) => {
        const next = new URLSearchParams(sp.toString());
        if (e.target.value === "default") next.delete("sort");
        else next.set("sort", e.target.value);
        next.delete("page");
        const qs = next.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }}
      className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500"
    >
      {SORT_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
