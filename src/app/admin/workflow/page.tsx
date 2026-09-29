import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatDate, gel } from "@/lib/format";
import { ROLE_LABEL, STEP_DEFS, canDo, canSee, currentStep, isOpen, type Role, type Step } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export const metadata = { title: "პროცესი" };

/**
 * განყოფილების სამუშაო სია — რომელი შეკვეთა ელოდება სწორედ ამ განყოფილებას.
 * ადმინი ყველა მიმდინარე შეკვეთას ხედავს, თითოეულთან — ვის ელოდება.
 *
 * ბარათებადაა და არა ცხრილად: კურიერი ამას ტელეფონიდან ხსნის.
 */
export default async function WorkflowPage() {
  const session = await getSession();
  const role = session?.role ?? "ADMIN";

  const orders = await db.order.findMany({
    where: { status: { notIn: ["CANCELLED", "EXPIRED", "RETURNED"] } },
    include: { steps: { select: { step: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const rows = orders
    .map((o) => {
      const done = new Set<string>(o.steps.map((s) => s.step));
      return { o, done, next: currentStep(done)! };
    })
    .filter((r) => r.next !== null);

  const mine = rows.filter((r) => canDo(role, r.next.step as Step) && isOpen(r.next.step as Step, r.done));
  const rest = rows.filter((r) => !mine.includes(r));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">პროცესი</h1>
        <p className="mt-1 text-sm text-muted">
          {role === "ADMIN"
            ? "ყველა მიმდინარე შეკვეთა — ვის ელოდება თითოეული."
            : `${ROLE_LABEL[role as Role] ?? role} — რომელ შეკვეთას სჭირდება შენი მოქმედება.`}
        </p>
      </div>

      <List title={`შენი დავალებები (${mine.length})`} rows={mine} role={role} mine />
      <List title={`დანარჩენი მიმდინარე (${rest.length})`} rows={rest} role={role} />

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">ნაბიჯების რიგი</h2>
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

type Row = {
  o: { id: string; number: string; total: number; customerName: string; createdAt: Date };
  done: Set<string>;
  next: { no: number; title: string; role: Role };
};

function List({ title, rows, role, mine }: { title: string; rows: Row[]; role: string; mine?: boolean }) {
  return (
    <section className={`card overflow-hidden ${mine && rows.length ? "border-brand-500" : ""}`}>
      <h2 className="border-b border-line p-4 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-muted">ცარიელია</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map(({ o, done, next }) => (
            <li key={o.id}>
              <Link href={`/admin/workflow/${o.id}`} className="flex flex-wrap gap-x-3 gap-y-1 p-4 hover:bg-canvas/60">
                <span className="font-medium text-brand-600">{o.number}</span>
                {canSee(role, "order", done) && <span className="min-w-0 flex-1 truncate">{o.customerName}</span>}
                <span className="ml-auto shrink-0 tabular-nums text-muted">{gel(o.total)}</span>
                <span className="w-full text-sm">
                  <span className="text-muted">{next.no}.</span> {next.title}
                  <span className="ml-2 rounded bg-canvas px-2 py-0.5 text-[11px] text-muted">
                    {mine ? "შენ" : ROLE_LABEL[next.role]}
                  </span>
                </span>
                <span className="w-full text-xs text-muted">{formatDate(o.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
