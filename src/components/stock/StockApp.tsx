"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SpecField } from "@/lib/pc-build/specs";

/**
 * საწყობის აპლიკაცია — კომპიუტერის კომპონენტები.
 *
 * ყველა მოთხოვნა enex.ge-ს საჯარო API-ზე მიდის, API გასაღებით (ტელეფონში
 * ერთხელ იწერება). ასე აპლიკაცია ერთნაირად მუშაობს ბრაუზერშიც და APK-შიც.
 */

type Cat = { id: string; slug: string; name: string; fields: SpecField[] };
type Product = {
  sku: string;
  nameKa: string;
  price: number;
  stockQty: number;
  isActive: boolean;
  categorySlug: string;
  images: string[];
  attrs: Record<string, string>;
};

const KEY_STORE = "enex_stock_key";
const money = (n: number) => `${(Number(n) || 0).toLocaleString("ka-GE")} ₾`;

export default function StockApp({ categories }: { categories: Cat[] }) {
  const [apiKey, setApiKey] = useState("");
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Product[]>([]);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState<Product | null>(null);

  useEffect(() => {
    try {
      const k = localStorage.getItem(KEY_STORE) ?? "";
      setApiKey(k);
      setReady(true);
    } catch {
      setReady(true);
    }
  }, []);

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(path, {
        ...init,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    [apiKey]
  );

  const load = useCallback(async () => {
    if (!apiKey) return;
    setBusy(true);
    setMsg("");
    try {
      const all: Product[] = [];
      for (const c of categories) {
        const r = await api(`/api/v1/products?category=${c.slug}&limit=200`);
        for (const p of r.data ?? []) {
          all.push({
            sku: p.sku,
            nameKa: p.nameKa,
            price: p.price,
            stockQty: p.stockQty,
            isActive: p.isActive,
            categorySlug: c.slug,
            images: (p.images ?? []).map((i: { url: string }) => i.url),
            attrs: Object.fromEntries((p.attributes ?? []).map((a: { name: string; value: string }) => [a.name, a.value])),
          });
        }
      }
      all.sort((a, b) => a.nameKa.localeCompare(b.nameKa, "ka"));
      setItems(all);
      setMsg(`${all.length} პოზიცია`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "შეცდომა");
    } finally {
      setBusy(false);
    }
  }, [api, apiKey, categories]);

  useEffect(() => {
    if (apiKey) void load();
  }, [apiKey, load]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter(
      (p) =>
        (cat === "all" || p.categorySlug === cat) &&
        (!term || p.nameKa.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term))
    );
  }, [items, cat, q]);

  /** ნაშთი იცვლება მაშინვე, სერვერზეც */
  async function setQty(p: Product, qty: number) {
    const next = Math.max(0, qty);
    setItems((list) => list.map((x) => (x.sku === p.sku ? { ...x, stockQty: next } : x)));
    try {
      await api(`/api/v1/stock/${encodeURIComponent(p.sku)}`, {
        method: "PUT",
        body: JSON.stringify({ qty: next }),
      });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "ვერ შეინახა");
      void load();
    }
  }

  if (!ready) return null;

  if (!apiKey) {
    return (
      <Setup
        onSave={(k) => {
          try {
            localStorage.setItem(KEY_STORE, k);
          } catch {
            /* ინკოგნიტოში არ შეინახება — სესიის ბოლომდე მაინც იმუშავებს */
          }
          setApiKey(k);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-3 pb-24 pt-3">
      <header className="mb-3 flex items-center gap-2">
        <h1 className="flex-1 text-lg font-bold">საწყობი — კომპონენტები</h1>
        <button onClick={() => void load()} disabled={busy} className="btn btn-outline px-3 py-2 text-sm">
          {busy ? "…" : "განახლება"}
        </button>
        <button
          onClick={() => {
            try {
              localStorage.removeItem(KEY_STORE);
            } catch {
              /* არაფერი */
            }
            setApiKey("");
          }}
          className="btn btn-outline px-3 py-2 text-sm"
          title="გასაღების შეცვლა"
        >
          ⚙
        </button>
      </header>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ძებნა დასახელებით ან კოდით"
        className="mb-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-brand-500"
      />

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        <Chip active={cat === "all"} onClick={() => setCat("all")}>
          ყველა ({items.length})
        </Chip>
        {categories.map((c) => (
          <Chip key={c.slug} active={cat === c.slug} onClick={() => setCat(c.slug)}>
            {c.name} ({items.filter((p) => p.categorySlug === c.slug).length})
          </Chip>
        ))}
      </div>

      {msg && <p className="mb-2 text-sm text-muted">{msg}</p>}

      <ul className="space-y-2">
        {shown.map((p) => (
          <li key={p.sku} className="card flex items-center gap-3 p-2.5">
            {p.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.images[0]} alt="" className="size-14 shrink-0 rounded-lg bg-white object-contain" />
            ) : (
              <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-canvas text-xs text-muted">
                ფოტო
              </span>
            )}
            <button onClick={() => setEdit(p)} className="min-w-0 flex-1 text-left">
              <div className="line-clamp-2 font-medium leading-tight">{p.nameKa}</div>
              <div className="font-mono text-xs text-muted">{p.sku}</div>
              <div className="text-sm">
                {money(p.price)}
                {!p.isActive && <span className="ml-2 text-xs text-warn">დამალული</span>}
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <Step onClick={() => void setQty(p, p.stockQty - 1)}>−</Step>
              <input
                value={p.stockQty}
                onChange={(e) => void setQty(p, Number(e.target.value.replace(/\D/g, "")) || 0)}
                inputMode="numeric"
                className="w-12 rounded-lg border border-line bg-surface py-2 text-center font-mono text-base outline-none focus:border-brand-500"
              />
              <Step onClick={() => void setQty(p, p.stockQty + 1)}>+</Step>
            </div>
          </li>
        ))}
        {!shown.length && !busy && <li className="card p-6 text-center text-muted">პოზიცია ვერ მოიძებნა</li>}
      </ul>

      <button
        onClick={() => setEdit({ sku: "", nameKa: "", price: 0, stockQty: 1, isActive: false, categorySlug: categories[0].slug, images: [], attrs: {} })}
        className="btn btn-primary fixed inset-x-0 bottom-0 z-20 mx-auto mb-4 w-[min(92%,36rem)] py-4 text-base shadow-lg"
      >
        + ახალი პოზიცია
      </button>

      {edit && (
        <Editor
          item={edit}
          categories={categories}
          api={api}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
        active ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-surface text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Step({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="size-10 rounded-lg border border-line bg-canvas text-lg leading-none active:bg-brand-50"
    >
      {children}
    </button>
  );
}

function Setup({ onSave }: { onSave: (key: string) => void }) {
  const [k, setK] = useState("");
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-2 text-xl font-bold">საწყობის აპლიკაცია</h1>
      <p className="mb-5 text-sm text-muted">
        შეიყვანე API გასაღები — ადმინ პანელში „API გასაღებები“, უფლებებით
        <b> stock:read</b> და <b> stock:write</b>. გასაღები მხოლოდ ამ მოწყობილობაზე ინახება.
      </p>
      <input
        value={k}
        onChange={(e) => setK(e.target.value)}
        placeholder="sk_live_…"
        autoComplete="off"
        className="mb-3 w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-brand-500"
      />
      <button onClick={() => k.trim() && onSave(k.trim())} className="btn btn-primary w-full py-3">
        შესვლა
      </button>
    </div>
  );
}

/** პოზიციის რედაქტორი — ახალიც და არსებულიც */
function Editor({
  item,
  categories,
  api,
  onClose,
  onSaved,
}: {
  item: Product;
  categories: Cat[];
  api: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !item.sku;
  const [form, setForm] = useState(item);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const cat = categories.find((c) => c.slug === form.categorySlug) ?? categories[0];

  const set = (patch: Partial<Product>) => setForm((f) => ({ ...f, ...patch }));
  const setAttr = (k: string, v: string) => setForm((f) => ({ ...f, attrs: { ...f.attrs, [k]: v } }));

  async function upload(file: File) {
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("ფაილი ვერ წაიკითხა"));
      r.readAsDataURL(file);
    });
    const res = (await api("/api/v1/uploads", { method: "POST", body: JSON.stringify({ data }) })) as { url: string };
    set({ images: [res.url] });
  }

  async function save() {
    setErr("");
    if (!form.nameKa.trim()) return setErr("დასახელება სავალდებულოა");
    if (isNew && !form.sku.trim()) return setErr("კოდი (SKU) სავალდებულოა");
    setSaving(true);
    try {
      await api("/api/v1/products", {
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              sku: form.sku.trim(),
              nameKa: form.nameKa.trim(),
              price: Number(form.price) || 0,
              qty: Number(form.stockQty) || 0,
              categorySlug: form.categorySlug,
              images: form.images,
              attributes: Object.entries(form.attrs)
                .filter(([, v]) => String(v).trim() !== "")
                .map(([name, value]) => ({ name, value: String(value) })),
            },
          ],
        }),
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ვერ შეინახა");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-2xl px-4 py-4">
        <header className="mb-4 flex items-center gap-2">
          <button onClick={onClose} className="btn btn-outline px-3 py-2">
            ←
          </button>
          <h2 className="flex-1 text-lg font-bold">{isNew ? "ახალი პოზიცია" : "რედაქტირება"}</h2>
        </header>

        <Field label="კატეგორია">
          <select
            value={form.categorySlug}
            onChange={(e) => set({ categorySlug: e.target.value })}
            disabled={!isNew}
            className="w-full rounded-xl border border-line bg-surface px-3 py-3 outline-none focus:border-brand-500"
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="კოდი (SKU)">
          <input
            value={form.sku}
            onChange={(e) => set({ sku: e.target.value })}
            disabled={!isNew}
            placeholder="მაგ. CPU-7600"
            className="w-full rounded-xl border border-line bg-surface px-3 py-3 font-mono outline-none focus:border-brand-500 disabled:text-muted"
          />
        </Field>

        <Field label="დასახელება">
          <input
            value={form.nameKa}
            onChange={(e) => set({ nameKa: e.target.value })}
            placeholder="AMD Ryzen 5 7600"
            className="w-full rounded-xl border border-line bg-surface px-3 py-3 outline-none focus:border-brand-500"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="ფასი (₾)">
            <input
              value={form.price || ""}
              onChange={(e) => set({ price: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
              inputMode="decimal"
              className="w-full rounded-xl border border-line bg-surface px-3 py-3 outline-none focus:border-brand-500"
            />
          </Field>
          <Field label="ნაშთი">
            <input
              value={form.stockQty}
              onChange={(e) => set({ stockQty: Number(e.target.value.replace(/\D/g, "")) || 0 })}
              inputMode="numeric"
              className="w-full rounded-xl border border-line bg-surface px-3 py-3 outline-none focus:border-brand-500"
            />
          </Field>
        </div>

        <Field label="ფოტო">
          <div className="flex items-center gap-3">
            {form.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.images[0]} alt="" className="size-20 rounded-lg bg-white object-contain" />
            ) : (
              <span className="flex size-20 items-center justify-center rounded-lg bg-canvas text-xs text-muted">
                არ არის
              </span>
            )}
            <label className="btn btn-outline cursor-pointer px-3 py-2 text-sm">
              კამერა / ფაილი
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f).catch((x) => setErr(x.message));
                }}
              />
            </label>
          </div>
        </Field>

        <h3 className="mb-2 mt-5 text-sm font-semibold text-muted">ტექნიკური მახასიათებლები</h3>
        {cat.fields.map((f) => (
          <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}${f.unit ? `, ${f.unit}` : ""}`}>
            {f.options ? (
              <select
                value={form.attrs[f.key] ?? ""}
                onChange={(e) => setAttr(f.key, e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-3 outline-none focus:border-brand-500"
              >
                <option value="">—</option>
                {f.type === "multi" ? (
                  <option value={f.options.join(", ")}>ყველა ({f.options.join(", ")})</option>
                ) : null}
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : f.type === "bool" ? (
              <select
                value={form.attrs[f.key] ?? ""}
                onChange={(e) => setAttr(f.key, e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-3 outline-none focus:border-brand-500"
              >
                <option value="">—</option>
                <option value="კი">კი</option>
                <option value="არა">არა</option>
              </select>
            ) : (
              <input
                value={form.attrs[f.key] ?? ""}
                onChange={(e) => setAttr(f.key, e.target.value)}
                inputMode={f.type === "number" ? "decimal" : "text"}
                className="w-full rounded-xl border border-line bg-surface px-3 py-3 outline-none focus:border-brand-500"
              />
            )}
          </Field>
        ))}

        {err && <p className="mb-3 text-sm text-rose-600">{err}</p>}

        <div className="sticky bottom-0 -mx-4 mt-4 flex gap-2 border-t border-line bg-canvas px-4 py-3">
          <button onClick={onClose} className="btn btn-outline flex-1 py-3">
            დახურვა
          </button>
          <button onClick={() => void save()} disabled={saving} className="btn btn-primary flex-[2] py-3">
            {saving ? "ინახება…" : "შენახვა"}
          </button>
        </div>
        {isNew && (
          <p className="pb-6 text-xs text-muted">
            ახალი პოზიცია დამალული ჩაიწერება — საიტზე გამოქვეყნება ადმინ პანელიდან ხდება.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}
