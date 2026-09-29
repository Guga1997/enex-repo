import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { ROLES, ROLE_LABEL, STEP_DEFS, type Role } from "@/lib/workflow";
import PasswordField from "@/components/admin/PasswordField";
import { createStaff, setStaffActive, setStaffPassword, updateStaff } from "../staff-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "თანამშრომლები" };

const field =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500";

const ERRORS: Record<string, string> = {
  email: "ელფოსტის მისამართი არასწორია",
  name: "სახელი სავალდებულოა",
  role: "აირჩიე განყოფილება",
  short: "პაროლი მინიმუმ 10 სიმბოლო უნდა იყოს",
  taken: "ამ ელფოსტით ანგარიში უკვე არსებობს",
  self: "საკუთარ ანგარიშს ადმინის უფლებას ვერ ჩამოხსნი",
};

const OK: Record<string, string> = {
  created: "ანგარიში შეიქმნა — გადაეცი თანამშრომელს ელფოსტა და პაროლი.",
  saved: "შენახულია.",
  password: "პაროლი შეიცვალა.",
  enabled: "ანგარიში ჩაირთო.",
  disabled: "ანგარიში გაითიშა — შესვლა აღარ შეუძლია.",
};

/**
 * თანამშრომლების ანგარიშები.
 *
 * თითოეულ ანგარიშს განყოფილება აქვს — და ამ განყოფილების მიხედვით ჩანს
 * ადმინ პანელში მხოლოდ ის, რაც მას სჭირდება. თანამშრომელი enex.ge/orders-ზე
 * შედის და პირდაპირ თავის სამუშაო სიას ხედავს.
 */
export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const session = (await getSession())!;
  const { ok, error } = await searchParams;

  const staff = await db.admin.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }] });
  const counts = await db.orderStep.groupBy({ by: ["adminId"], _count: { _all: true } });
  const byAdmin = new Map(counts.map((c) => [c.adminId, c._count._all]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">თანამშრომლები</h1>
        <p className="mt-1 text-sm text-muted">
          ანგარიშს აქ ქმნი — სერვერზე შესვლა აღარ სჭირდება. თანამშრომელი შედის{" "}
          <b>enex.ge/orders</b>-ზე და პირდაპირ თავის სამუშაო სიაზე ხვდება; ადმინ პანელის
          დანარჩენი გვერდები მას არ უჩანს.
        </p>
      </div>

      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{ERRORS[error] ?? error}</p>}
      {ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{OK[ok] ?? ok}</p>}

      <form action={createStaff} className="card space-y-4 p-5">
        <h2 className="font-semibold">ახალი ანგარიში</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">ელფოსტა</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="off"
              spellCheck={false}
              className={field}
              placeholder="sales@enex.ge"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">სახელი</span>
            <input
              name="name"
              required
              autoComplete="off"
              spellCheck={false}
              className={field}
              placeholder="ნინო ბერიძე"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">განყოფილება</span>
            <select name="role" defaultValue="SALES" className={field}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="max-w-md">
          <PasswordField />
        </div>
        <button className="btn btn-primary hover:bg-brand-600">ანგარიშის შექმნა</button>
      </form>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line p-4 font-semibold">ანგარიშები ({staff.length})</h2>
        <ul className="divide-y divide-line">
          {staff.map((a) => {
            const label = ROLE_LABEL[a.role as Role] ?? a.role;
            const isMe = a.id === session.id;
            return (
              <li key={a.id} className={`space-y-3 p-4 ${a.active ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <b>{a.name}</b>
                  <span className="text-muted">{a.email}</span>
                  <span className="rounded bg-canvas px-2 py-0.5 text-[11px]">{label}</span>
                  {isMe && <span className="rounded bg-brand-50 px-2 py-0.5 text-[11px] text-brand-600">შენ</span>}
                  {!a.active && (
                    <span className="rounded bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">გათიშული</span>
                  )}
                  <span className="ml-auto text-xs text-muted">
                    {byAdmin.get(a.id) ?? 0} დადასტურებული ნაბიჯი · {formatDate(a.createdAt)}
                  </span>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  <form action={updateStaff} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={a.id} />
                    <label className="block flex-1">
                      <span className="mb-1 block text-xs text-muted">სახელი</span>
                      <input
                        name="name"
                        defaultValue={a.name}
                        required
                        autoComplete="off"
                        spellCheck={false}
                        className={field}
                      />
                    </label>
                    <label className="block flex-1">
                      <span className="mb-1 block text-xs text-muted">განყოფილება</span>
                      <select name="role" defaultValue={a.role} className={field}>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="btn btn-outline px-3 py-2 text-xs">შენახვა</button>
                  </form>

                  <form action={setStaffPassword} className="flex items-end gap-2 lg:col-span-2">
                    <input type="hidden" name="id" value={a.id} />
                    <div className="flex-1">
                      <PasswordField label="ახალი პაროლი" />
                    </div>
                    <button className="btn btn-outline px-3 py-2 text-xs">შეცვლა</button>
                  </form>
                </div>

                {!isMe && (
                  <form action={setStaffActive}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="active" value={a.active ? "0" : "1"} />
                    <button className="text-xs text-muted underline hover:text-ink">
                      {a.active ? "ანგარიშის გათიშვა" : "ანგარიშის ჩართვა"}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">რომელი განყოფილება რას აკეთებს</h2>
        <p className="mb-3 text-sm text-muted">
          ადმინისტრატორს ყველა ნაბიჯი და ყველა გვერდი უჩანს.
        </p>
        <ol className="space-y-1.5 text-sm">
          {STEP_DEFS.map((d) => (
            <li key={d.step} className="flex gap-2">
              <span className="w-6 shrink-0 text-muted">{d.no}.</span>
              <span className="flex-1">{d.title}</span>
              <span className="text-muted">{ROLE_LABEL[d.role]}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
