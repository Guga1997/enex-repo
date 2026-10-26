import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/customer-auth";
import { formatDate } from "@/lib/format";
import { getT, titleMeta } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const generateMetadata = titleMeta("გარანტია");

export default async function WarrantyPage() {
  const t = await getT();
  const user = (await getCurrentUser())!;

  const items = await db.orderItem.findMany({
    where: { order: { userId: user.id }, warrantyUntil: { not: null } },
    include: { order: { select: { number: true, createdAt: true } } },
    orderBy: { warrantyUntil: "desc" },
  });

  const now = Date.now();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t("გარანტია")}</h1>

      {items.length === 0 ? (
        <p className="card p-6 text-center text-muted">
          {t("გარანტიაზე მყოფი პროდუქტი ჯერ არ არის.")}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const until = it.warrantyUntil!;
            const active = until.getTime() > now;
            const daysLeft = Math.ceil((until.getTime() - now) / 86_400_000);

            return (
              <div key={it.id} className="card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{it.name}</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      active ? "bg-emerald-50 text-emerald-700" : "bg-canvas text-muted"
                    }`}
                  >
                    {active ? t("ძალაშია — დარჩა {0} დღე", daysLeft) : t("ვადა ამოიწურა")}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-muted">
                  <p>{t("კოდი:")} #{it.sku} · {t("შეკვეთა")} {it.order.number}</p>
                  <p>
                    {t("ვადა:")} {formatDate(until)}
                    {it.warrantyMonths ? ` (${t("{0} თვე", it.warrantyMonths)})` : ""}
                  </p>
                  {it.serialNumbers && <p>{t("სერიული:")} {it.serialNumbers.replace(/\n/g, ", ")}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
