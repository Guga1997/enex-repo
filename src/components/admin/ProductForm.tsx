import Link from "next/link";
import { saveProduct } from "@/app/admin/actions";
import ImageUploader from "./ImageUploader";
import { STOCK_LABELS } from "@/lib/constants";

type Category = { id: string; nameKa: string; parentId: string | null };

type ProductData = {
  id: string;
  sku: string;
  nameKa: string;
  nameEn: string | null;
  model: string | null;
  descriptionKa: string | null;
  price: number;
  oldPrice: number | null;
  cost: number | null;
  stockQty: number;
  stockStatus: string;
  incomingDate: Date | null;
  lowStockAt: number;
  categoryId: string;
  isActive: boolean;
  isNew: boolean;
  featured: boolean;
  sortOrder: number;
  brand: { name: string } | null;
  images: { url: string }[];
  attributes: { name: string; value: string }[];
};

export default function ProductForm({
  product,
  categories,
  brandNames,
}: {
  product?: ProductData;
  categories: Category[];
  brandNames: string[];
}) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const label = (c: Category) =>
    c.parentId && byId.has(c.parentId) ? `${byId.get(c.parentId)!.nameKa} → ${c.nameKa}` : c.nameKa;

  return (
    <form action={saveProduct} className="space-y-5">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {product ? `რედაქტირება: ${product.nameKa}` : "ახალი პროდუქტი"}
        </h1>
        <div className="flex gap-2">
          <Link href="/admin/products" className="btn btn-outline">გაუქმება</Link>
          <button className="btn btn-primary hover:bg-brand-600">შენახვა</button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">ძირითადი ინფორმაცია</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="sku"
                label="კოდი (SKU)"
                required
                defaultValue={product?.sku}
                readOnly={!!product}
                hint={product ? "კოდი შექმნის შემდეგ არ იცვლება" : "უნიკალური შიდა კოდი, მაგ. 03904"}
              />
              <Field name="model" label="მოდელი" defaultValue={product?.model ?? ""} hint="მწარმოებლის მოდელი" />
            </div>
            <Field name="nameKa" label="დასახელება (ქართულად)" required defaultValue={product?.nameKa} />
            <Field name="nameEn" label="დასახელება (ინგლისურად)" defaultValue={product?.nameEn ?? ""} />

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">აღწერა</span>
              <textarea
                name="descriptionKa"
                rows={6}
                defaultValue={product?.descriptionKa ?? ""}
                className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              />
            </label>
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">სურათები</h2>
            <ImageUploader name="images" initial={product?.images.map((i) => i.url) ?? []} />
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">მახასიათებლები</h2>
            <p className="text-xs text-muted">
              თითო ხაზზე ერთი მახასიათებელი, ფორმატით <code>სახელი: მნიშვნელობა</code>.
              ეს მნიშვნელობები ავტომატურად ხდება კატალოგის ფილტრი.
            </p>
            <textarea
              name="attributes"
              rows={7}
              placeholder={"რეზოლუცია: 4მპ\nობიექტივი: 2.8მმ\nკორპუსი: Dome\nIR მანძილი: 30მ"}
              defaultValue={product?.attributes.map((a) => `${a.name}: ${a.value}`).join("\n") ?? ""}
              className="w-full rounded-lg border border-line px-3 py-2.5 font-mono text-sm outline-none focus:border-brand-500"
            />
          </section>
        </div>

        <div className="space-y-5">
          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">ფასი</h2>
            <Field name="price" label="ფასი (₾)" type="number" step="0.01" required defaultValue={product?.price} />
            <Field
              name="oldPrice"
              label="ძველი ფასი (₾)"
              type="number"
              step="0.01"
              defaultValue={product?.oldPrice ?? ""}
              hint="შევსების შემთხვევაში ჩნდება ფასდაკლების ნიშანი"
            />
            <Field
              name="cost"
              label="თვითღირებულება (₾)"
              type="number"
              step="0.01"
              defaultValue={product?.cost ?? ""}
              hint="მხოლოდ შიდა გამოყენებისთვის"
            />
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">მარაგი</h2>
            <Field name="stockQty" label="რაოდენობა" type="number" defaultValue={product?.stockQty ?? 0} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">სტატუსი</span>
              <select
                name="stockStatus"
                defaultValue={product?.stockStatus ?? "IN_STOCK"}
                className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              >
                {Object.entries(STOCK_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <Field
              name="incomingDate"
              label="ჩამოსვლის თარიღი"
              type="date"
              defaultValue={product?.incomingDate?.toISOString().slice(0, 10) ?? ""}
              hint='ჩანს "გზაშია" სტატუსზე'
            />
            <Field
              name="lowStockAt"
              label="მცირე მარაგის ზღვარი"
              type="number"
              defaultValue={product?.lowStockAt ?? 5}
              hint='ამ ზღვარს ქვემოთ ჩნდება "დარჩენილია N ცალი"'
            />
          </section>

          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">კლასიფიკაცია</h2>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                კატეგორია <span className="text-rose-500">*</span>
              </span>
              <select
                name="categoryId"
                required
                defaultValue={product?.categoryId ?? ""}
                className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              >
                <option value="">— აირჩიე —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{label(c)}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">ბრენდი</span>
              <input
                name="brandName"
                list="brand-list"
                defaultValue={product?.brand?.name ?? ""}
                className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              />
              <datalist id="brand-list">
                {brandNames.map((b) => <option key={b} value={b} />)}
              </datalist>
              <span className="mt-1 block text-xs text-muted">ახალი ბრენდი ავტომატურად შეიქმნება</span>
            </label>

            <Field name="sortOrder" label="რიგითობა" type="number" defaultValue={product?.sortOrder ?? 0} />
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="font-semibold">ხილვადობა</h2>
            <Toggle name="isActive" label="აქტიური (ჩანს საიტზე)" defaultChecked={product?.isActive ?? true} />
            <Toggle name="isNew" label='ნიშანი "ახალი"' defaultChecked={product?.isNew ?? false} />
            <Toggle name="featured" label="მთავარ გვერდზე" defaultChecked={product?.featured ?? false} />
          </section>
        </div>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  defaultValue,
  hint,
  step,
  readOnly,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  hint?: string;
  step?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        readOnly={readOnly}
        defaultValue={defaultValue}
        className={`w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500 ${
          readOnly ? "bg-canvas text-muted" : ""
        }`}
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-brand-500" />
      {label}
    </label>
  );
}
