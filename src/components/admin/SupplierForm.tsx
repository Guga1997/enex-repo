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
  retailBase: string;
  markupRetail: number;
  markupDealer: number;
  syncEveryMin: number;
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
  "images": "photos",
  "imageBase": "https://partner.ge",
  "categoryPath": ["category", "subcategory", "childcategory"],
  "attributes": "variations",
  "available": "is_available"
}`;

/** intellcom-ს ველების შესაბამისობა არ სჭირდება — ადაპტერი მას იცნობს.
 *  ერთადერთი, რაც აქ იწერება, საიდენტიფიკაციო კოდია სწორი ფასისთვის. */
const INTELLCOM_MAP = `{
  "identificationCode": "შენი ს/კ"
}`;

/** Excel: ფურცლების აღწერა — რომელი სვეტი რას ნიშნავს (სვეტები 0-დან ითვლება) */
const SHEET_MAP = `{
  "skuStrip": "/GE",
  "sheets": {
    "BLUETTI": {
      "brand": "Bluetti",
      "category": ["ენერგო უზრუნველყოფა", "პორტატული ელსადგურები"],
      "columns": { "sku": 0, "name": 1, "cost": 2, "qty": 3 },
      "rules": [
        { "contains": "Expansion Battery", "category": ["ენერგო უზრუნველყოფა", "პორტატული ელსადგურები", "დამატებითი აკუმულატორები"] },
        { "contains": "Solar Panel", "category": ["ენერგო უზრუნველყოფა", "მზის ენერგია", "მზის პანელები"] },
        { "contains": "Home Battery", "category": ["ენერგო უზრუნველყოფა", "პორტატული ელსადგურები", "სახლის სარეზერვო სისტემები"] },
        { "contains": "Hybrid Inverter", "category": ["ენერგო უზრუნველყოფა", "პორტატული ელსადგურები", "სახლის სარეზერვო სისტემები"] },
        { "contains": "Power Station", "category": ["ენერგო უზრუნველყოფა", "პორტატული ელსადგურები", "ელსადგურები"] }
      ]
    },
    "DELTA": {
      "brand": "Delta Electronics",
      "category": ["ენერგო უზრუნველყოფა"],
      "columns": { "sku": 0, "name": 1, "cost": 2 },
      "sectionRows": true,
      "rate": 1
    }
  }
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
  const [adapter, setAdapter] = useState(supplier?.adapter ?? "GENERIC_REST");
  const [showHelp, setShowHelp] = useState(false);
  const [retailBase, setRetailBase] = useState(supplier?.retailBase ?? "COST");
  const isIntellcom = adapter === "INTELLCOM";
  const isSheet = adapter === "SPREADSHEET";

  return (
    <form action={action} encType="multipart/form-data" className="card space-y-4 p-5">
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
          <select
            name="adapter"
            value={adapter}
            onChange={(e) => setAdapter(e.target.value)}
            className={field}
          >
            {adapters.map((a) => (
              <option key={a} value={a}>
                {a === "GENERIC_REST" ? "GENERIC_REST — API კონფიგურაციით" : a === "SPREADSHEET" ? "SPREADSHEET — Excel ფასთა ნუსხა" : a}
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
            <option value="QUERY">გასაღები მისამართში (?api_key=…)</option>
            <option value="NONE">არ სჭირდება</option>
          </select>
        </label>

        {(authType === "HEADER_KEY" || authType === "QUERY") && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              {authType === "QUERY" ? "პარამეტრის სახელი" : "ჰედერის სახელი"}
            </span>
            <input
              name="authHeader"
              defaultValue={supplier?.authHeader ?? (authType === "QUERY" ? "api_key" : "X-API-Key")}
              className={field}
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">გასაღები</span>
          <input
            name="secret"
            type="password"
            autoComplete="off"
            placeholder={supplier?.hasSecret ? "შენახულია — შესაცვლელად ჩაწერე ახალი" : ""}
            className={field}
          />
          <span className="mt-1 block text-xs text-muted">
            {authType === "NONE"
              ? "ზოგი კომპანია გასაღებს მისამართში ატარებს — ველი მაშინაც საჭიროა"
              : authType === "QUERY"
                ? "მისამართს ბოლოში მიეწერება — baseUrl-ში გასაღები არ ჩაწერო"
                : "ავტორიზაციის ჰედერში გაიგზავნება"}
          </span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">საცალო ფასი ითვლება</span>
          <select
            name="retailBase"
            value={retailBase}
            onChange={(e) => setRetailBase(e.target.value)}
            className={field}
          >
            <option value="COST">თვითღირებულებიდან (+%)</option>
            <option value="LIST">მიმწოდებლის საცალოდან (−%)</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            {retailBase === "LIST" ? "საცალო: % მიმწოდებლის საცალოზე" : "საცალო: % თვითღირებულებაზე"}
          </span>
          <input
            name="markupRetail"
            type="number"
            step="0.1"
            defaultValue={supplier?.markupRetail ?? (retailBase === "LIST" ? -5 : 30)}
            className={field}
          />
          <span className="mt-1 block text-xs text-muted">
            {retailBase === "LIST" ? "მინუსი = მასზე იაფად: −5 → მისი 100₾ ჩვენთან 95₾" : "30 → 100₾ თვითღირებულება, 130₾ ფასი"}
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">სადილერო: % თვითღირებულებაზე</span>
          <input
            name="markupDealer"
            type="number"
            step="0.1"
            defaultValue={supplier?.markupDealer ?? 15}
            className={field}
          />
          <span className="mt-1 block text-xs text-muted">15 → მისი 100₾ სადილერო ჩვენთან 115₾</span>
        </label>
      </div>

      {isSheet && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">ფასთა ნუსხა (Excel .xlsx)</span>
          <input name="pricelist" type="file" accept=".xlsx,.xls" className={field} />
          <span className="mt-1 block text-xs text-muted">
            ატვირთვისთანავე სინქი გაივლის. ახალი ნუსხა ძველს ცვლის. თუ ფაილი ბმულით გაქვს
            (Google Sheets-ის „გამოქვეყნება xlsx-ად“) — ზემოთ მისამართში ჩაწერე და აქ არაფერი ატვირთო.
          </span>
        </label>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">ავტომატური სინქი — ყოველ რამდენ წუთში</span>
        <input
          name="syncEveryMin"
          type="number"
          min={0}
          step={1}
          defaultValue={supplier?.syncEveryMin ?? 10}
          className={field}
        />
        <span className="mt-1 block text-xs text-muted">
          0 — მხოლოდ ხელით, „სინქი“ ღილაკით. სერვერი წუთში ერთხელ ამოწმებს, ვის მოუვიდა დრო.
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">ველების შესაბამისობა (fieldMap)</span>
          {!isIntellcom && (
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="text-xs text-brand-600 hover:underline"
            >
              {showHelp ? "დამალვა" : "მაგალითის ჩვენება"}
            </button>
          )}
        </span>
        <textarea
          name="fieldMap"
          rows={isIntellcom ? 4 : isSheet ? 16 : showHelp ? 12 : 5}
          defaultValue={supplier?.fieldMap ?? (isSheet ? SHEET_MAP : "")}
          placeholder={
            isIntellcom
              ? INTELLCOM_MAP
              : isSheet
                ? SHEET_MAP
                : showHelp
                  ? EXAMPLE_MAP
                  : "JSON — რომელი ველი რას ნიშნავს ამ კომპანიის პასუხში"
          }
          className={`${field} font-mono text-xs`}
        />
        <span className="mt-1 block text-xs text-muted">
          {isIntellcom ? (
            <>
              ველების შესაბამისობა ამ ადაპტერს არ სჭირდება. ჩაწერე მხოლოდ{" "}
              <code>identificationCode</code> — მის გარეშე სადილერო ფასი ნულით მოვა.
            </>
          ) : isSheet ? (
            <>
              თითო ფურცელი — სახელი ზუსტად როგორც Excel-შია; <code>columns</code> სვეტების ნომრებია
              (A=0, B=1…). <code>sectionRows</code>: ცარიელი SKU-იანი სტრიქონი განყოფილებაა და
              კატეგორიად ემატება. <code>rate</code>: ფასის კოეფიციენტი, მაგ. დოლარიდან ლარში.
            </>
          ) : (
            <>
              <code>listPath</code> — სად ძევს სია პასუხში. დანარჩენი ველები მიმწოდებლის
              სახელებს ჩვენსას უკავშირებს. ცარიელი დატოვე, თუ სახელები ისედაც ემთხვევა.
            </>
          )}
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
        გამოაქვეყნე. ფასი პროდუქტს შემოსვლისას ეწერება; პროცენტის შეცვლის მერე
        არსებულებზე „ფასების გადათვლა“ დააჭირე — ხელით ჩაკეტილ ფასს ის არ ეხება.
      </p>

      <button className="btn btn-primary hover:bg-brand-600">
        {supplier ? "შენახვა" : "დამატება"}
      </button>
    </form>
  );
}
