"use client";

import { useState } from "react";
import { saveSupplierPricing } from "@/app/admin/prices/actions";

/**
 * ერთი მიმწოდებლის ფასის წესი. ფორმულა და პროცენტი ერთად ჩანს და
 * მაგალითიც მაშინვე ითვლება — „5“ რას ნიშნავს, ჩამოსაშლელის გარეშე
 * გაუგებარი იყო და ფასები შემთხვევით იცვლებოდა.
 */

type Supplier = {
  id: string;
  name: string;
  retailBase: string;
  markupRetail: number;
  supplierDiscount: number;
  minMargin: number;
};

type Stats = {
  products: number;
  withList: number;
  sample: { cost: number; list: number | null } | null;
};

const MEANING: Record<string, string> = {
  MARGIN: "% მოგებიდან",
  LIST: "% მის საცალოზე",
  COST: "% თვითღირებულებაზე",
};

const input =
  "w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand-500";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** იგივე ფორმულა, რაც სერვერზე — მხოლოდ მაგალითის საჩვენებლად */
function preview(base: string, pct: number, discount: number, minMargin: number, s: Stats["sample"]) {
  if (!s) return null;
  const twoPrices = s.list != null && s.list > s.cost;
  const cost = twoPrices ? s.cost : r2(s.cost * (1 - Math.min(Math.max(discount, 0), 90) / 100));
  let price: number;
  if (base === "MARGIN" && twoPrices) price = r2(s.list! - (pct / 100) * (s.list! - cost));
  else price = r2((base === "LIST" && twoPrices ? s.list! : s.cost) * (1 + pct / 100));
  price = Math.max(price, r2(cost * (1 + Math.max(minMargin, 0) / 100)));
  return { cost, list: twoPrices ? s.list : null, price };
}

export default function SupplierPricingRow({ supplier, stats }: { supplier: Supplier; stats: Stats }) {
  const [base, setBase] = useState(supplier.retailBase);
  const [pct, setPct] = useState(String(supplier.markupRetail));
  const [discount, setDiscount] = useState(String(supplier.supplierDiscount));
  const [floor, setFloor] = useState(String(supplier.minMargin));

  const ex = preview(base, Number(pct) || 0, Number(discount) || 0, Number(floor) || 0, stats.sample);
  const marginWithoutList = base === "MARGIN" && stats.withList < stats.products;

  return (
    <form action={saveSupplierPricing} className="grid gap-3 border-b border-line p-4 last:border-0 lg:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_auto] lg:items-end">
      <input type="hidden" name="id" value={supplier.id} />

      <div>
        <div className="font-semibold">{supplier.name}</div>
        <div className="text-xs text-muted">
          {stats.products} პროდუქტი · ორი ფასი API-დან: {stats.withList}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">საცალო ფასი</span>
        <div className="flex gap-1.5">
          <input name="markupRetail" value={pct} onChange={(e) => setPct(e.target.value)} inputMode="decimal" className={`${input} w-20`} />
          <select name="retailBase" value={base} onChange={(e) => setBase(e.target.value)} className={input}>
            <option value="MARGIN">{MEANING.MARGIN}</option>
            <option value="LIST">{MEANING.LIST}</option>
            <option value="COST">{MEANING.COST}</option>
          </select>
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-muted" title="მხოლოდ მაშინ, როცა მიმწოდებელი ერთ ფასს აგზავნის">
          ერთფასიანზე ფასდაკლება %
        </span>
        <input name="supplierDiscount" value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" className={input} />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-muted" title="ფასი თვითღირებულებაზე ამ პროცენტით მაინც მაღლა დგება">
          მინ. მოგება %
        </span>
        <input name="minMargin" value={floor} onChange={(e) => setFloor(e.target.value)} inputMode="decimal" className={input} />
      </label>

      <button className="btn btn-primary whitespace-nowrap px-4 py-2 text-sm">შენახვა და გადათვლა</button>

      <div className="text-xs text-muted lg:col-span-5">
        {ex ? (
          <>
            მაგალითი: ქოსთი <b>{ex.cost.toFixed(2)}₾</b>
            {ex.list != null && <> · მისი საცალო <b>{ex.list.toFixed(2)}₾</b></>} → ჩვენი ფასი{" "}
            <b className="text-ink">{ex.price.toFixed(2)}₾</b>
          </>
        ) : (
          "მაგალითისთვის პროდუქტი არ არის"
        )}
        {marginWithoutList && (
          <span className="ml-2 text-amber-600">
            · {stats.products - stats.withList} პოზიციას მისი საცალო არ აქვს — იქ {pct}% თვითღირებულებაზე დაედება
          </span>
        )}
      </div>
    </form>
  );
}
