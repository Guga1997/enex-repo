import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import ProductForm from "@/components/admin/ProductForm";
import DocumentUploader from "@/components/admin/DocumentUploader";
import { addProductDocument, deleteProductDocument } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "პროდუქტის რედაქტირება" };

const DOC_KIND: Record<string, string> = {
  DATASHEET: "ტექნიკური დოკუმენტაცია",
  CERTIFICATE: "სერტიფიკატი",
  MANUAL: "ინსტრუქცია",
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories, brands] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        brand: { select: { name: true } },
        images: { select: { url: true }, orderBy: { sortOrder: "asc" } },
        attributes: { select: { name: true, value: true }, orderBy: { sortOrder: "asc" } },
        documents: { orderBy: { sortOrder: "asc" } },
        supplies: { include: { supplier: { select: { name: true } } } },
      },
    }),
    db.category.findMany({
      select: { id: true, nameKa: true, parentId: true },
      orderBy: { nameKa: "asc" },
    }),
    db.brand.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <ProductForm product={product} categories={categories} brandNames={brands.map((b) => b.name)} />

      {/* მიმწოდებლები — ნაშთი აქედან იკრიბება, ამიტომ ხელით არ იცვლება */}
      {product.supplies.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold">მიმწოდებლები</h2>
          <p className="mt-1 text-sm text-muted">
            პროდუქტის ნაშთი ({product.stockQty}) ამ წყაროების ჯამია და სინქზე გადაითვლება.
          </p>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-2 font-medium">კომპანია</th>
                <th className="py-2 font-medium">მისი კოდი</th>
                <th className="py-2 text-right font-medium">ღირებულება</th>
                <th className="py-2 text-right font-medium">ნაშთი</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {product.supplies.map((s) => (
                <tr key={s.id}>
                  <td className="py-2">{s.supplier.name}</td>
                  <td className="py-2 font-mono text-xs">{s.supplierSku}</td>
                  <td className="py-2 text-right">{s.cost ?? "—"}</td>
                  <td className="py-2 text-right font-medium">{s.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">დოკუმენტაცია</h2>
          <p className="mt-1 text-sm text-muted">
            ატვირთული ფაილი პროდუქტის გვერდზე ჩამოსატვირთად გამოჩნდება.
          </p>
        </div>

        {product.documents.length > 0 && (
          <div className="divide-y divide-line rounded-lg border border-line">
            {product.documents.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-brand-600 hover:underline"
                  >
                    {d.title}
                  </a>
                  <div className="text-xs text-muted">
                    {DOC_KIND[d.kind] ?? d.kind}
                    {d.sizeBytes ? ` · ${Math.round(d.sizeBytes / 1024)} KB` : ""}
                  </div>
                </div>
                <form action={deleteProductDocument}>
                  <input type="hidden" name="id" value={d.id} />
                  <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                    წაშლა
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        <DocumentUploader productId={product.id} action={addProductDocument} />
      </section>
    </div>
  );
}
