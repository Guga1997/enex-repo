import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatDate, gel } from "@/lib/format";
import { ROLE_LABEL, STEP_DEFS, canDo, currentStep, isOpen, type Role, type Step } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export const metadata = { title: "პროცესი" };

/**
 * განყოფილების სამუშაო სია — რომელი შეკვეთა ელოდება სწორედ ამ განყოფილებას.
 * ადმინი ყველა მიმდინარე შეკვეთას ხედავს, თითოეულთან — ვის ელოდება.
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
      const done = new Set(o.steps.map((s) => s.step));
      return { o, done, next: currentStep(done) };
    })
    .filter((r) => r.next !== null);

  const mine = rows.filter((r) => canDo(role, r.next!.step as Step) && isOpen(r.next!.step as Step, r.done));
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

      <Table title={`შენი დავალებები (${mine.length})`} rows={mine} highlight />
      <Table title={`დანარჩენი მიმდინარე (${rest.length})`} rows={rest} />

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

type Row = { o: { id: string; number: string; total: number; customerName: string; createdAt: Date }; next: { no: number; title: string; role: Role } | null };

function Table({ title, rows, highlight }: { title: string; rows: Row[]; highlight?: boolean }) {
  return (
    <section className={`card overflow-x-auto ${highlight && rows.length ? "border-brand-500" : ""}`}>
      <h2 className="border-b border-line p-4 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-muted">ცარიელია</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-canvas text-left text-xs text-muted">
            <tr>
              <th className="p-3 font-medium">შეკვეთა</th>
              <th className="p-3 font-medium">მომხმარებელი</th>
              <th className="p-3 text-right font-medium">თანხა</th>
              <th className="p-3 font-medium">შემდეგი ნაბიჯი</th>
              <th className="p-3 font-medium">ელოდება</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ o, next }) => (
              <tr key={o.id} className="hover:bg-canvas/60">
                <td className="p-3">
                  <Link href={`/admin/orders/${o.id}`} className="font-medium text-brand-600 hover:underline">
                    {o.number}
                  </Link>
                  <div className="text-xs text-muted">{formatDate(o.createdAt)}</div>
                </td>
                <td className="p-3">{o.customerName}</td>
                <td className="p-3 text-right tabular-nums">{gel(o.total)}</td>
                <td className="p-3">
                  <span className="text-muted">{next!.no}.</span> {next!.title}
                </td>
                <td className="p-3 text-muted">{ROLE_LABEL[next!.role]}</td>
                <td className="p-3 text-right">
                  <Link href={`/admin/orders/${o.id}`} className="btn btn-outline px-3 py-1.5 text-xs">
                    გახსნა
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
