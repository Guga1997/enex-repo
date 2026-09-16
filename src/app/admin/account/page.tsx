import { getSession } from "@/lib/auth";
import { changeAdminEmail, changeAdminPassword } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "ადმინის ანგარიში" };

const field =
  "w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500";

const ERRORS: Record<string, string> = {
  short: "ახალი პაროლი მინიმუმ 10 სიმბოლო უნდა იყოს",
  mismatch: "პაროლები არ ემთხვევა",
  current: "მიმდინარე პაროლი არასწორია",
  email: "ელფოსტის მისამართი არასწორია",
  taken: "ეს ელფოსტა უკვე გამოყენებულია",
};

export default async function AdminAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const session = (await getSession())!;
  const { ok, error } = await searchParams;
  const isDefault = session.email === "admin@example.ge";

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">ადმინის ანგარიში</h1>
        <p className="mt-1 text-sm text-muted">
          შესული ხარ როგორც <b>{session.email}</b>
        </p>
      </div>

      {isDefault && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <b>ნაგულისხმევი ანგარიში.</b> ეს ელფოსტა და პაროლი კოდის საჯარო რეპოზიტორიაშია —
          ნებისმიერს შეუძლია წაიკითხოს. შეცვალე ორივე, სანამ საიტზე ნამდვილი მონაცემები
          გამოჩნდება.
        </p>
      )}
      {ok && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">პაროლი შეიცვალა.</p>
      )}
      {error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{ERRORS[error] ?? error}</p>
      )}

      <form action={changeAdminPassword} className="card space-y-4 p-5">
        <h2 className="font-semibold">პაროლის შეცვლა</h2>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">მიმდინარე პაროლი</span>
          <input name="current" type="password" required autoComplete="current-password" className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">ახალი პაროლი</span>
          <input
            name="next"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            className={field}
            placeholder="მინიმუმ 10 სიმბოლო"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">გაიმეორე ახალი პაროლი</span>
          <input name="next2" type="password" required autoComplete="new-password" className={field} />
        </label>
        <button className="btn btn-primary hover:bg-brand-600">შეცვლა</button>
      </form>

      <form action={changeAdminEmail} className="card space-y-4 p-5">
        <h2 className="font-semibold">ელფოსტის შეცვლა</h2>
        <p className="text-sm text-muted">შეცვლის შემდეგ ხელახლა შესვლა დაგჭირდება.</p>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">ახალი ელფოსტა</span>
          <input name="email" type="email" required defaultValue={session.email} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">პაროლი დასადასტურებლად</span>
          <input name="password" type="password" required autoComplete="current-password" className={field} />
        </label>
        <button className="btn btn-outline">შეცვლა</button>
      </form>
    </div>
  );
}
