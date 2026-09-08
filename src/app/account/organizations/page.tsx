import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/customer-auth";
import { formatDate } from "@/lib/format";
import OrganizationForm from "@/components/OrganizationForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "ყველა ორგანიზაცია" };

export default async function OrganizationsPage() {
  const user = (await getCurrentUser())!;
  const orgs = await db.organization.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { orders: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">ყველა ორგანიზაცია</h1>
        <p className="mt-1 text-sm text-muted">
          ერთი ანგარიშიდან რამდენიმე იურიდიული პირის სახელზე შეგიძლია შეკვეთა — ინვოისი
          არჩეული ორგანიზაციის რეკვიზიტებით გამოიწერება.
        </p>
      </div>

      {orgs.length === 0 ? (
        <p className="card p-6 text-center text-muted">ორგანიზაცია ჯერ დამატებული არ არის.</p>
      ) : (
        <div className="space-y-3">
          {orgs.map((o) => (
            <div key={o.id} className="card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{o.name}</span>
                {o.isDefault && (
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                    ნაგულისხმევი
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-1 text-sm text-muted">
                <p>საიდენტიფიკაციო კოდი: {o.taxId}</p>
                <p>მისამართი: {o.address}</p>
                <p>
                  შეკვეთა: {o._count.orders} · დამატებულია {formatDate(o.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <OrganizationForm />
    </div>
  );
}
