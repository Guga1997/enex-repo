import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { createApiKey, deleteApiKey, revokeApiKey } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "API გასაღებები" };

export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  const keys = await db.apiKey.findMany({ orderBy: { createdAt: "desc" } });

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.ge";

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">API გასაღებები</h1>
      <p className="text-sm text-muted">
        ამ გასაღებებით გარე სისტემა (საწყობი, ბუღალტერია, ERP) კითხულობს და წერს
        ნაშთებს. გასაღები ინახება მხოლოდ ჰეშირებული სახით — შექმნის შემდეგ
        ხელახლა ვერ ნახავ.
      </p>

      {created && (
        <div className="card border-emerald-200 bg-emerald-50 p-5">
          <h2 className="font-semibold text-emerald-800">ახალი გასაღები შეიქმნა</h2>
          <p className="mt-1 text-sm text-emerald-700">
            დააკოპირე ახლავე — ეს ერთადერთი შემთხვევაა, როცა ის ჩანს.
          </p>
          <code className="mt-3 block break-all rounded-lg bg-white p-3 font-mono text-sm">
            {created}
          </code>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="p-3 font-medium">დასახელება</th>
                <th className="p-3 font-medium">გასაღები</th>
                <th className="p-3 font-medium">უფლებები</th>
                <th className="p-3 font-medium">ბოლო გამოყენება</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keys.map((k) => (
                <tr key={k.id} className={k.isActive ? "" : "opacity-50"}>
                  <td className="p-3 font-medium">{k.name}</td>
                  <td className="p-3 font-mono text-xs text-muted">{k.prefix}…</td>
                  <td className="p-3 text-xs">{k.scopes}</td>
                  <td className="p-3 text-xs text-muted">
                    {k.lastUsedAt ? formatDate(k.lastUsedAt) : "არასდროს"}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      {k.isActive && (
                        <form action={revokeApiKey}>
                          <input type="hidden" name="id" value={k.id} />
                          <button className="rounded border border-line px-2 py-1 text-xs hover:bg-canvas">
                            გათიშვა
                          </button>
                        </form>
                      )}
                      <form action={deleteApiKey}>
                        <input type="hidden" name="id" value={k.id} />
                        <button className="rounded border border-line px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">
                          წაშლა
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-muted">
                    გასაღები ჯერ არ არის შექმნილი.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form action={createApiKey} className="card h-fit space-y-4 p-5">
          <h2 className="font-semibold">ახალი გასაღები</h2>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">დასახელება</span>
            <input
              name="name"
              required
              placeholder="ORIS სინქრონიზაცია"
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">უფლებები</span>
            <select
              name="scopes"
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            >
              <option value="stock:read,stock:write">კითხვა + ჩაწერა</option>
              <option value="stock:read">მხოლოდ კითხვა</option>
            </select>
          </label>
          <button className="btn btn-primary w-full hover:bg-brand-600">შექმნა</button>
        </form>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">API-ის მოკლე დოკუმენტაცია</h2>
        <p className="mb-4 text-sm text-muted">
          ავთენტიფიკაცია: <code className="rounded bg-canvas px-1.5 py-0.5">Authorization: Bearer &lt;გასაღები&gt;</code>
          {" "}ან <code className="rounded bg-canvas px-1.5 py-0.5">X-API-Key: &lt;გასაღები&gt;</code>
        </p>

        <div className="space-y-3 text-sm">
          <Endpoint method="GET" path="/api/v1/stock" desc="ყველა პროდუქტის ნაშთი (?page, ?limit, ?updated_since)" />
          <Endpoint method="GET" path="/api/v1/stock/{sku}" desc="ერთი პროდუქტის ნაშთი" />
          <Endpoint method="PUT" path="/api/v1/stock/{sku}" desc="ერთი პროდუქტის ნაშთის/ფასის განახლება" />
          <Endpoint method="POST" path="/api/v1/stock" desc="მასობრივი განახლება (2000 პოზიციამდე ერთ მოთხოვნაში)" />
          <Endpoint method="GET" path="/api/v1/products" desc="სრული კატალოგის ექსპორტი" />
          <Endpoint method="POST" path="/api/v1/products" desc="პროდუქტების შექმნა/განახლება SKU-ს მიხედვით" />
          <Endpoint method="GET" path="/api/v1/orders" desc="შეკვეთების წამოღება (?status, ?since)" />
        </div>

        <h3 className="mb-2 mt-6 text-sm font-semibold">მაგალითი — ნაშთების მასობრივი განახლება</h3>
        <pre className="overflow-x-auto rounded-lg bg-ink p-4 text-xs leading-relaxed text-white">
{`curl -X POST ${base}/api/v1/stock \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [
      { "sku": "03904", "qty": 12, "price": 729.00 },
      { "sku": "03426", "qty": 0, "status": "IN_TRANSIT",
        "incomingDate": "2026-09-11T00:00:00.000Z" }
    ]
  }'`}
        </pre>
      </section>
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const color =
    method === "GET" ? "bg-sky-100 text-sky-700" : method === "PUT" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className={`w-14 shrink-0 rounded px-2 py-0.5 text-center text-xs font-bold ${color}`}>
        {method}
      </span>
      <code className="font-mono text-xs">{path}</code>
      <span className="text-xs text-muted">{desc}</span>
    </div>
  );
}
