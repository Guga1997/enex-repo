import { db } from "@/lib/db";
import { formatDate, gel } from "@/lib/format";
import { setUserTier } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "მომხმარებლები" };

const field = "rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-brand-500";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = q?.trim();

  const users = await db.user.findMany({
    where: term
      ? {
          OR: [
            { name: { contains: term } },
            { email: { contains: term } },
            { phone: { contains: term } },
            { taxId: { contains: term } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { orders: true, organizations: true } },
      orders: { where: { paymentStatus: "PAID" }, select: { total: true } },
    },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">მომხმარებლები</h1>
        <p className="mt-1 text-sm text-muted">
          ფასის დონე განსაზღვრავს, რომელ ფასს ხედავს მომხმარებელი. სადილერო ფასი
          პროდუქტზეა მითითებული; თუ პროდუქტს არ აწერია, ინდივიდუალური პროცენტი
          მოქმედებს საცალო ფასზე.
        </p>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={term}
          placeholder="ძებნა სახელით, ელფოსტით, ნომრით ან კოდით"
          className="w-full max-w-md rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <button className="btn btn-outline">ძებნა</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="p-3 font-medium">მომხმარებელი</th>
              <th className="p-3 font-medium">ტიპი</th>
              <th className="p-3 font-medium">შეკვეთები</th>
              <th className="p-3 font-medium">დადასტურება</th>
              <th className="p-3 font-medium">ფასის დონე</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted">
                  {term ? "ვერაფერი მოიძებნა." : "დარეგისტრირებული მომხმარებელი ჯერ არ არის."}
                </td>
              </tr>
            )}

            {users.map((u) => {
              const paid = u.orders.reduce((s, o) => s + o.total, 0);
              const verified = Boolean(u.emailVerifiedAt && u.phoneVerifiedAt);

              return (
                <tr key={u.id} className={u.isActive ? "" : "opacity-50"}>
                  <td className="p-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted">
                      {u.email} · +995 {u.phone}
                    </div>
                    <div className="text-xs text-muted">
                      ს/კ {u.taxId} · რეგისტრაცია {formatDate(u.createdAt)}
                    </div>
                  </td>

                  <td className="p-3 text-xs">
                    {u.type === "COMPANY" ? "იურიდიული" : "ფიზიკური"}
                    {u._count.organizations > 0 && (
                      <div className="text-muted">{u._count.organizations} ორგანიზაცია</div>
                    )}
                  </td>

                  <td className="p-3 text-xs">
                    {u._count.orders} შეკვეთა
                    {paid > 0 && <div className="text-muted">გადახდილი {gel(paid)}</div>}
                  </td>

                  <td className="p-3 text-xs">
                    {verified ? (
                      <span className="text-emerald-700">✓ სრულად</span>
                    ) : (
                      <span className="text-amber-700">
                        {u.emailVerifiedAt ? "✓" : "✗"} ელფოსტა ·{" "}
                        {u.phoneVerifiedAt ? "✓" : "✗"} ნომერი
                      </span>
                    )}
                  </td>

                  <td className="p-3">
                    <form action={setUserTier} className="flex flex-wrap items-center gap-1.5">
                      <input type="hidden" name="id" value={u.id} />
                      <select name="priceTier" defaultValue={u.priceTier} className={field}>
                        <option value="RETAIL">საცალო</option>
                        <option value="DEALER">სადილერო</option>
                      </select>
                      <input
                        name="discountPercent"
                        type="number"
                        step="0.5"
                        min="0"
                        max="90"
                        defaultValue={u.discountPercent}
                        title="დამატებითი ფასდაკლება %"
                        className={`${field} w-16`}
                      />
                      <label className="flex items-center gap-1 text-xs" title="აქტიური ანგარიში">
                        <input
                          type="checkbox"
                          name="isActive"
                          defaultChecked={u.isActive}
                          className="size-3.5 accent-brand-500"
                        />
                        აქტ.
                      </label>
                      <button className="rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-600">
                        შენახვა
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
