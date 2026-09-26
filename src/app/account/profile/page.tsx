import { getCurrentUser } from "@/lib/customer-auth";
import { setNewsletterAction } from "@/app/actions/customer";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "პერსონალური ინფორმაცია" };

export default async function ProfilePage() {
  const t = await getT();
  const user = (await getCurrentUser())!;
  const isCompany = user.type === "COMPANY";

  const rows: [string, string][] = [
    [isCompany ? "დასახელება" : "სახელი და გვარი", user.name],
    [isCompany ? "საიდენტიფიკაციო კოდი" : "პირადი ნომერი", user.taxId],
    ["ფიზიკური მისამართი", user.address],
    ["ელფოსტა", user.email],
    ["ტელეფონი", `+995 ${user.phone}`],
    ["ტიპი", isCompany ? "იურიდიული პირი" : "ფიზიკური პირი"],
    ["რეგისტრაციის თარიღი", formatDate(user.createdAt)],
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t("პერსონალური ინფორმაცია")}</h1>

      <div className="card divide-y divide-line">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap gap-2 px-4 py-3 text-sm">
            <span className="w-56 shrink-0 text-muted">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 px-4 py-3 text-sm">
          <span className="w-56 shrink-0 text-muted">{t("დადასტურება")}</span>
          <span className="font-medium text-emerald-700">
            {t("✓ ელფოსტა · ✓ მობილური")}
          </span>
        </div>
      </div>

      <form action={setNewsletterAction} className="card space-y-3 p-4">
        <p className="font-medium">{t("სიახლეების გამოწერა")}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="newsletter"
            defaultChecked={user.newsletter}
            className="h-4 w-4 rounded border-line"
          />
          {t("მინდა მივიღო ინფორმაცია ფასდაკლებებსა და ახალ პროდუქტებზე")}
        </label>
        <button className="btn btn-primary hover:bg-brand-600">{t("შენახვა")}</button>
      </form>

      <p className="text-sm text-muted">
        {t("რეკვიზიტების შესაცვლელად დაგვიკავშირდი — ისინი შეკვეთებსა და ინვოისებზეა მიბმული.")}
      </p>
    </div>
  );
}
