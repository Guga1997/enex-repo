"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { STOCK_LABELS } from "@/lib/constants";
import { attrKey, type Facets } from "@/lib/catalog";
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

  /** დიაპაზონისთვის — რამდენიმე მნიშვნელობა ერთად ინიშნება/იხსნება */
  function toggleValues(key: string, values: string[]) {
    const next = new URLSearchParams(sp.toString());
    const cur = selected(key);
    const allOn = values.every((v) => cur.includes(v));
    const updated = allOn ? cur.filter((v) => !values.includes(v)) : [...new Set([...cur, ...values])];
    if (updated.length) next.set(key, updated.join(","));
    else next.delete(key);
    push(next);
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

  /** მონიშნული ფილტრები ერთ სიაში — ჩიპებისთვის */
  const active: { key: string; value: string; label: string; remove: () => void }[] = [
    ...selected("brand").map((v) => ({
      key: "brand",
      value: v,
      label: facets.brands.find((b) => b.slug === v)?.name ?? v,
      remove: () => toggleMulti("brand", v),
    })),
    ...selected("status").map((v) => ({
      key: "status",
      value: v,
      label: t(STOCK_LABELS[v] ?? v),
      remove: () => toggleMulti("status", v),
    })),
    ...facets.attributes.flatMap((attr) => {
      const key = attrKey(attr.name);
      const cur = selected(key);
      // მონიშნული დიაპაზონი ერთ ჩიპად, ცალკეული მნიშვნელობა — თავისით
      const ranges = attr.values.filter((v) => v.members && v.members.every((m) => cur.includes(m)));
      const inRange = new Set(ranges.flatMap((r) => r.members!));
      return [
        ...ranges.map((r) => ({
          key: attr.name,
          value: r.value,
          label: `${attr.name}: ${r.value}`,
          remove: () => toggleValues(key, r.members!),
        })),
        ...cur
          .filter((v) => !inRange.has(v))
          .map((v) => ({
            key: attr.name,
            value: v,
            label: `${attr.name}: ${v}`,
            remove: () => toggleMulti(key, v),
          })),
      ];
    }),
    ...(sp.get("discount") === "1"
      ? [{ key: "discount", value: "1", label: t("ფასდაკლება"), remove: () => toggleFlag("discount") }]
      : []),
    ...(sp.get("new") === "1" ? [{ key: "new", value: "1", label: t("ახალი"), remove: () => toggleFlag("new") }] : []),
    ...(sp.get("min") || sp.get("max")
      ? [
          {
            key: "price",
            value: "range",
            label: `${t("ფასი")}: ${sp.get("min") ?? facets.priceMin} — ${sp.get("max") ?? facets.priceMax} ₾`,
            remove: () => {
              const next = new URLSearchParams(sp.toString());
              next.delete("min");
              next.delete("max");
              setMin("");
              setMax("");
              push(next);
            },
          },
        ]
      : []),
  ];

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

          {/* მონიშნული ფილტრები — ერთი შეხედვით ჩანს რა არის გააქტიურებული */}
          {active.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-4">
              {active.map((a) => (
                <button
                  key={a.key + a.value}
                  onClick={a.remove}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
                  title={t("წაშლა")}
                >
                  {a.label}
                  <span aria-hidden>×</span>
                </button>
              ))}
            </div>
          )}

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
            const key = attrKey(attr.name);
            return (
              <Section key={attr.name} title={attr.name} scroll>
                {attr.values.map((v) => {
                  // დიაპაზონი = მისი ყველა მნიშვნელობა ერთად
                  const members = v.members ?? [v.value];
                  const cur = selected(key);
                  return (
                    <Check
                      key={v.value}
                      label={v.value}
                      count={v.count}
                      checked={members.every((m) => cur.includes(m))}
                      onChange={() => toggleValues(key, members)}
                    />
                  );
                })}
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
