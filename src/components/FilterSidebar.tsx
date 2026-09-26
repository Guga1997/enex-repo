"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { STOCK_LABELS } from "@/lib/constants";
import type { Facets } from "@/lib/catalog";
import { useT } from "@/components/LocaleProvider";

export default function FilterSidebar({ facets }: { facets: Facets }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const [min, setMin] = useState(sp.get("min") ?? "");
  const [max, setMax] = useState(sp.get("max") ?? "");

  const selected = (key: string) => (sp.get(key) ?? "").split(",").filter(Boolean);

  function push(next: URLSearchParams) {
    next.delete("page"); // ფილტრის ცვლილებაზე ყოველთვის პირველ გვერდზე
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function toggleMulti(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    const cur = selected(key);
    const updated = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    if (updated.length) next.set(key, updated.join(","));
    else next.delete(key);
    push(next);
  }

  function toggleFlag(key: string) {
    const next = new URLSearchParams(sp.toString());
    if (next.get(key) === "1") next.delete(key);
    else next.set(key, "1");
    push(next);
  }

  function applyPrice() {
    const next = new URLSearchParams(sp.toString());
    if (min.trim()) next.set("min", min.trim());
    else next.delete("min");
    if (max.trim()) next.set("max", max.trim());
    else next.delete("max");
    push(next);
  }

  function reset() {
    const next = new URLSearchParams();
    const q = sp.get("q");
    if (q) next.set("q", q);
    setMin("");
    setMax("");
    push(next);
  }

  const activeCount =
    ["brand", "status"].reduce((n, k) => n + selected(k).length, 0) +
    (sp.get("min") || sp.get("max") ? 1 : 0) +
    (sp.get("discount") === "1" ? 1 : 0) +
    (sp.get("new") === "1" ? 1 : 0) +
    [...sp.keys()].filter((k) => k.startsWith("attr_")).length;

  return (
    <>
      {/* მობილურზე ფილტრი ჩაკეცილია */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn btn-outline mb-3 w-full lg:hidden"
        aria-expanded={open}
      >
        ფილტრი {activeCount > 0 ? `(${activeCount})` : ""}
      </button>

      <aside
        className={[
          open ? "block" : "hidden",
          "lg:block transition-opacity",
          pending ? "opacity-60" : "",
        ].join(" ")}
      >
        <div className="card divide-y divide-line">
          <div className="flex items-center justify-between p-4">
            <h2 className="font-semibold">{t("ფილტრი")}</h2>
            {activeCount > 0 && (
              <button onClick={reset} className="text-xs font-medium text-brand-600 hover:underline">
                {t("გასუფთავება")}
              </button>
            )}
          </div>

          <Section title={t("ფასი")}>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder={String(facets.priceMin)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <span className="text-muted">—</span>
              <input
                type="number"
                inputMode="numeric"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder={String(facets.priceMax)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <span className="text-sm text-muted">₾</span>
            </div>
            <button onClick={applyPrice} className="btn btn-primary mt-3 w-full">
              {t("გაფილტვრა")}
            </button>
          </Section>

          {facets.brands.length > 0 && (
            <Section title={t("ბრენდი")} scroll>
              {facets.brands.map((b) => (
                <Check
                  key={b.slug}
                  label={b.name}
                  count={b.count}
                  checked={selected("brand").includes(b.slug)}
                  onChange={() => toggleMulti("brand", b.slug)}
                />
              ))}
            </Section>
          )}

          {facets.statuses.length > 0 && (
            <Section title={t("სტატუსი")}>
              {facets.statuses.map((s) => (
                <Check
                  key={s.key}
                  label={t(STOCK_LABELS[s.key] ?? s.key)}
                  count={s.count}
                  checked={selected("status").includes(s.key)}
                  onChange={() => toggleMulti("status", s.key)}
                />
              ))}
            </Section>
          )}

          {(facets.discountCount > 0 || facets.newCount > 0) && (
            <Section title={t("დამატებითი მახასიათებლები")}>
              {facets.discountCount > 0 && (
                <Check
                  label={t("ფასდაკლება")}
                  count={facets.discountCount}
                  checked={sp.get("discount") === "1"}
                  onChange={() => toggleFlag("discount")}
                />
              )}
              {facets.newCount > 0 && (
                <Check
                  label={t("ახალი")}
                  count={facets.newCount}
                  checked={sp.get("new") === "1"}
                  onChange={() => toggleFlag("new")}
                />
              )}
            </Section>
          )}

          {/* დინამიური მახასიათებლები — რეზოლუცია, პორტების რაოდენობა და ა.შ. */}
          {facets.attributes.map((attr) => {
            const key = `attr_${encodeURIComponent(attr.name)}`;
            return (
              <Section key={attr.name} title={attr.name} scroll>
                {attr.values.map((v) => (
                  <Check
                    key={v.value}
                    label={v.value}
                    count={v.count}
                    checked={selected(key).includes(v.value)}
                    onChange={() => toggleMulti(key, v.value)}
                  />
                ))}
              </Section>
            );
          })}
        </div>
      </aside>
    </>
  );
}

function Section({
  title,
  children,
  scroll,
}: {
  title: string;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <div className="p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className={scroll ? "max-h-64 space-y-1 overflow-y-auto pr-1" : "space-y-1"}>
        {children}
      </div>
    </div>
  );
}

function Check({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm hover:bg-canvas">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 accent-brand-500"
      />
      <span className="flex-1 leading-tight">{label}</span>
      <span className="text-xs text-muted">({count})</span>
    </label>
  );
}
