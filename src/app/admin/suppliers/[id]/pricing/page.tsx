import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Pricer } from "@/lib/suppliers/pricing";
import { deletePricingRule, savePricingRule } from "../../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "სეგმენტების ფასები" };

const field =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500";

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;

/**
 * ფასწარმოქმნა მიმწოდებელი × სეგმენტი.
 * წესი ქვეკატეგორიებზეც ვრცელდება, სანამ იქ უფრო კონკრეტული არ დაიწერება.
 */
export default async function SupplierPricingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplier = await db.supplier.findUnique({
    where: { id },
    include: { pricingRules: { include: { category: true } } },
  });
  if (!supplier) notFound();

  const cats = await db.category.findMany({
    select: { id: true, nameKa: true, parentId: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });
  const byId = new Map(cats.map((c) => [c.id, c]));
  const pathOf = (cid: string): string => {
    const parts: string[] = [];
    let cur = byId.get(cid);
    for (let d = 0; cur && d < 10; d++) {
      parts.unshift(cur.nameKa);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return parts.join(" › ");
  };
  const depthOf = (cid: string) => pathOf(cid).split(" › ").length - 1;

  // რამდენ პროდუქტს ეხება თითო წესი ამ მიმწოდებლისგან — უშუალოდ თუ მშობლის სახით
  const products = await db.product.findMany({
    where: { supplies: { some: { supplierId: id } } },
    select: { categoryId: true },
  });
  const pricer = await Pricer.load();
  const counts = new Map<string, number>();
  for (const p of products) {
    let cat: string | null = p.categoryId;
    for (let d = 0; cat && d < 10; d++) {
      if (supplier.pricingRules.some((r) => r.categoryId === cat)) {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
        break;
      }
      cat = byId.get(cat)?.parentId ?? null;
    }
  }
  const coveredByDefault = products.filter((p) => pricer.ruleSource(id, p.categoryId) === "supplier").length;

  // ხე თანმიმდევრობით — სეგმენტი, მისი ქვეჯგუფები, მათი ქვე-ქვეჯგუფები
  const ordered: typeof cats = [];
  const walk = (parentId: string | null) => {
    for (const c of cats.filter((x) => x.parentId === parentId)) {
      ordered.push(c);
      walk(c.id);
    }
  };
  walk(null);

  const rules = [...supplier.pricingRules].sort((a, b) =>
    pathOf(a.categoryId).localeCompare(pathOf(b.categoryId), "ka")
  );

  return (
    <div className="space-y-5">
      <div>
        <a href="/admin/suppliers" className="text-sm text-brand-600 hover:underline">
          ← მიმწოდებლები
        </a>
        <h1 className="mt-1 text-2xl font-bold">{supplier.name} — სეგმენტების ფასები</h1>
        <p className="mt-1 text-sm text-muted">
          პროცენტი მიმწოდებლის ფასს მიჰყვება: ყოველი სინქი თავიდან ითვლის. წესი ქვეკატეგორიებზეც
          მოქმედებს, სანამ იქ უფრო კონკრეტული არ ეწერება. სეგმენტი წესის გარეშე ნაგულისხმევს იყენებს.
        </p>
      </div>

      <div className="card p-4 text-sm">
        <span className="text-muted">ნაგულისხმევი (ყველა დანარჩენ სეგმენტზე):</span>{" "}
        საცალო <b>{pct(supplier.markupRetail)}</b>{" "}
        {supplier.retailBase === "LIST" ? "მის საცალოზე" : "თვითღირებულებაზე"} · სადილერო{" "}
        <b>{pct(supplier.markupDealer)}</b> თვითღირებულებაზე ·{" "}
        <span className="text-muted">{coveredByDefault} პროდუქტი</span>
        <a href={`/admin/suppliers?edit=${supplier.id}`} className="ml-3 text-brand-600 hover:underline">
          შეცვლა
        </a>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="p-3 font-medium">სეგმენტი</th>
              <th className="p-3 font-medium">საცალო</th>
              <th className="p-3 font-medium">სადილერო</th>
              <th className="p-3 font-medium">პროდუქტი</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rules.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted">
                  სეგმენტური წესი ჯერ არ არის — ყველაფერი ნაგულისხმევით ითვლება.
                </td>
              </tr>
            )}
            {rules.map((r) => (
              <tr key={r.id}>
                <td className="p-3">{pathOf(r.categoryId)}</td>
                <td className="p-3">
                  {pct(r.markupRetail)}{" "}
                  <span className="text-xs text-muted">
                    {r.retailBase === "LIST" ? "მის საცალოზე" : "თვითღ."}
                  </span>
                </td>
                <td className="p-3">{pct(r.markupDealer)} <span className="text-xs text-muted">თვითღ.</span></td>
                <td className="p-3 text-muted">{counts.get(r.categoryId) ?? 0}</td>
                <td className="p-3 text-right">
                  <form action={deletePricingRule}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                      წაშლა
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={savePricingRule} className="card space-y-4 p-5">
        <h2 className="font-semibold">წესის დამატება / შეცვლა</h2>
        <input type="hidden" name="supplierId" value={supplier.id} />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">სეგმენტი</span>
          <select name="categoryId" required className={field} defaultValue="">
            <option value="" disabled>აირჩიე…</option>
            {ordered.map((c) => (
              <option key={c.id} value={c.id}>
                {" ".repeat(depthOf(c.id) * 4)}{c.nameKa}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            უკვე არსებულ სეგმენტზე შენახვა წესს გადააწერს. შენახვისთანავე ამ მიმწოდებლის ფასები გადაითვლება.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">საცალო ფასი ითვლება</span>
            <select name="retailBase" className={field} defaultValue={supplier.retailBase}>
              <option value="COST">თვითღირებულებიდან (+%)</option>
              <option value="LIST">მიმწოდებლის საცალოდან (−%)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">საცალო, %</span>
            <input name="markupRetail" type="number" step="0.1" required defaultValue={supplier.markupRetail} className={field} />
            <span className="mt-1 block text-xs text-muted">მინუსი შეიძლება: −5 = მის საცალოზე 5%-ით იაფად</span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">სადილერო, % თვითღირებულებაზე</span>
            <input name="markupDealer" type="number" step="0.1" required defaultValue={supplier.markupDealer} className={field} />
          </label>
        </div>

        <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          შენახვა და გადათვლა
        </button>
      </form>
    </div>
  );
}
