"use client";

import { useState } from "react";

const field =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500";

export type SupplierDraft = {
  id: string;
  name: string;
  adapter: string;
  baseUrl: string | null;
  authType: string;
  authHeader: string | null;
  fieldMap: string | null;
  markupRetail: number;
  markupDealer: number;
  isActive: boolean;
  hasSecret: boolean;
};

const EXAMPLE_MAP = `{
  "listPath": "data.items",
  "sku": "code",
  "name": "title",
  "brand": "manufacturer",
  "model": "article",
  "category": "group",
  "cost": "price",
  "qty": "balance",
  "incomingDate": "eta",
  "images": "photos"
}`;

export default function SupplierForm({
  action,
  adapters,
  supplier,
}: {
  action: (formData: FormData) => void;
  adapters: string[];
  supplier: SupplierDraft | null;
}) {
  const [authType, setAuthType] = useState(supplier?.authType ?? "BEARER");
  const [showHelp, setShowHelp] = useState(false);

  return (
    <form action={action} className="card space-y-4 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">
          {supplier ? `რედაქტირება — ${supplier.name}` : "ახალი მიმწოდებელი"}
        </h2>
        {supplier && (
          <a href="/admin/suppliers" className="text-sm text-brand-600 hover:underline">
            ახლის დამატება
          </a>
        )}
      </div>

      {supplier && <input type="hidden" name="id" value={supplier.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">კომპანიის დასახელება</span>
          <input name="name" required defaultValue={supplier?.name} className={field} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">ადაპტერი</span>
          <select name="adapter" defaultValue={supplier?.adapter ?? "GENERIC_REST"} className={field}>
            {adapters.map((a) => (
              <option key={a} value={a}>
                {a === "GENERIC_REST" ? "GENERIC_REST — კონფიგურაციით, კოდის გარეშე" : a}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">API-ის მისამართი</span>
        <input
          name="baseUrl"
          type="url"
          defaultValue={supplier?.baseUrl ?? ""}
          placeholder="https://partner.example.ge/api/v1/products"
          className={field}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">ავტორიზაცია</span>
          <select
            name="authType"
            value={authType}
            onChange={(e) => setAuthType(e.target.value)}
            className={field}
          >
            <option value="BEARER">Bearer token</option>
            <option value="HEADER_KEY">გასაღები ჰედერში</option>
            <option value="BASIC">Basic</option>
            <option value="NONE">არ სჭირდება</option>
          </select>
        </label>

        {authType === "HEADER_KEY" && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">ჰედერის სახელი</span>
            <input
              name="authHeader"
              defaultValue={supplier?.authHeader ?? "X-API-Key"}
              className={field}
            />
          </label>
        )}

        {authType !== "NONE" && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">გასაღები</span>
            <input
              name="secret"
              type="password"
              placeholder={supplier?.hasSecret ? "შენახულია — შესაცვლელად ჩაწერე ახალი" : ""}
              className={field}
            />
          </label>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">ფასდადება საცალოზე, %</span>
          <input
            name="markupRetail"
            type="number"
            step="0.1"
            defaultValue={supplier?.markupRetail ?? 30}
            className={field}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">ფასდადება სადილეროზე, %</span>
          <input
            name="markupDealer"
            type="number"
            step="0.1"
            defaultValue={supplier?.markupDealer ?? 15}
            className={field}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">ველების შესაბამისობა (fieldMap)</span>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="text-xs text-brand-600 hover:underline"
          >
            {showHelp ? "დამალვა" : "მაგალითის ჩვენება"}
          </button>
        </span>
        <textarea
          name="fieldMap"
          rows={showHelp ? 12 : 5}
          defaultValue={supplier?.fieldMap ?? ""}
          placeholder={showHelp ? EXAMPLE_MAP : "JSON — რომელი ველი რას ნიშნავს ამ კომპანიის პასუხში"}
          className={`${field} font-mono text-xs`}
        />
        <span className="mt-1 block text-xs text-muted">
          <code>listPath</code> — სად ძევს სია პასუხში. დანარჩენი ველები მიმწოდებლის
          სახელებს ჩვენსას უკავშირებს. ცარიელი დატოვე, თუ სახელები ისედაც ემთხვევა.
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={supplier?.isActive ?? true}
          className="size-4 accent-brand-500"
        />
        აქტიურია
      </label>

      <p className="rounded-lg bg-canvas p-3 text-xs text-muted">
        ახალი პროდუქტი სინქიდან მოდის <b>გამორთული</b> — ჯერ დაათვალიერე და მერე
        გამოაქვეყნე. ხელით დაყენებულ ფასს სინქი აღარ ცვლის, მხოლოდ ნაშთსა და
        თვითღირებულებას ანახლებს.
      </p>

      <button className="btn btn-primary hover:bg-brand-600">
        {supplier ? "შენახვა" : "დამატება"}
      </button>
    </form>
  );
}
