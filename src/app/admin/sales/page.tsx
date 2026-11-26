import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { gel, formatDate } from "@/lib/format";
import { customerComment } from "@/lib/invoice";
import { cancelSaleAction, soldAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "მაღაზიის გაყიდვები" };

const PER_PAGE = 40;

const TABS = [
  { key: "", label: "მომზადებული", where: { status: "PENDING", paymentStatus: { not: "PAID" } } },
  { key: "sold", label: "გაყიდული", where: { paymentStatus: "PAID" } },
  { key: "closed", label: "გაუქმებული / ვადაგასული", where: { status: { in: ["CANCELLED", "EXPIRED"] } } },
  { key: "all", label: "ყველა", where: {} },
] satisfies { key: string; label: string; where: Prisma.OrderWhereInput }[];

type SP = { tab?: string; q?: string; page?: string; ok?: string; error?: string };

/**
 * მაღაზიის გაყიდვები — გაყიდვების მომზადებული და დადასტურებული ჩანაწერები ერთ სიაში.
 * ხედავს გაყიდვები და ადმინი; ყველა ჩანაწერი „შეკვეთებშიც“ ჩანს.
 */
export default async function StoreSalesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireStaff("/admin/sales");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === (sp.tab ?? "")) ?? TABS[0];
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim().slice(0, 80);

  const search: Prisma.OrderWhereInput = q
    ? { OR: [{ number: { contains: q } }, { customerName: { contains: q } }, { customerPhone: { contains: q } }, { companyName: { contains: q } }, { items: { some: { name: { contains: q } } } }] }
    : {};
  const base: Prisma.OrderWhereInput = { channel: "STORE", ...search };
  const where: Prisma.OrderWhereInput = { AND: [base, tab.where] };

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const [orders, total, counts, today] = await Promise.all([
    db.order.findMany({ where, include: { items: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    db.order.count({ where }),
    Promise.all(TABS.map((t) => db.order.count({ where: { AND: [base, t.where] } }))),
    db.order.aggregate({ where: { channel: "STORE", paymentStatus: "PAID", updatedAt: { gte: dayStart } }, _sum: { total: true }, _count: true }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab: sp.tab, q: sp.q, ...patch })) if (v) next.set(k, String(v));
    const qs = next.toString();
    return qs ? `/admin/sales?${qs}` : "/admin/sales";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">მაღაზიის გაყიდვები</h1>
          <p className="mt-1 text-sm text-muted">
            დღეს გაყიდული: <b className="text-ink">{today._count}</b> · {gel(today._sum.total ?? 0)}
          </p>
        </div>
        <Link href="/admin/sales/new" className="btn btn-primary hover:bg-brand-600">+ ახალი გაყიდვა</Link>
      </div>

      {sp.ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{sp.ok}</p>}
      {sp.error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{sp.error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t, i) => {
          const active = tab.key === t.key;
          return (
            <Link
              key={t.key}
              href={href({ tab: t.key || undefined })}
              className={`rounded-full border px-4 py-1.5 text-sm ${active ? "border-brand-500 bg-brand-500 font-medium text-white" : "border-line bg-surface hover:border-brand-500"}`}
            >
              {t.label} <span className={active ? "text-white/80" : "text-muted"}>{counts[i]}</span>
            </Link>
          );
        })}
        <form className="ml-auto flex gap-2">
          {sp.tab && <input type="hidden" name="tab" value={sp.tab} />}
          <input name="q" defaultValue={q} placeholder="ნომერი, მყიდველი, ნივთი" className="w-56 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500" />
          <button className="btn btn-outline px-3 py-2 text-sm">ძებნა</button>
        </form>
      </div>

      <div className="space-y-3">
        {orders.map((o) => {
          const sold = o.paymentStatus === "PAID";
          const pending = o.status === "PENDING" && !sold;
          const note = customerComment(o.comment);
          return (
            <div
              key={o.id}
              className={`card p-4 ${sold ? "border-emerald-500/60 bg-emerald-50/60 dark:bg-emerald-500/10" : pending ? "" : "opacity-60"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/orders/${o.id}`} className="font-semibold hover:text-brand-600">{o.number}</Link>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        sold ? "bg-emerald-600 text-white" : pending ? "bg-amber-100 text-amber-800" : "bg-canvas text-muted"
                      }`}
                    >
                      {sold ? "გაყიდულია" : pending ? "მომზადებული" : o.status === "EXPIRED" ? "ვადა გაუვიდა" : "გაუქმებული"}
                    </span>
                    <span className="text-xs text-muted">{formatDate(o.createdAt)}{o.staffName ? ` · ${o.staffName}` : ""}</span>
                  </div>
                  <div className="mt-1 text-sm">
                    {o.companyName ? `${o.companyName} (${o.customerName})` : o.customerName}
                    {o.customerPhone && <span className="text-muted"> · {o.customerPhone}</span>}
                    {o.customerId && <span className="text-muted"> · ს/კ {o.customerId}</span>}
                  </div>
                  <ul className="mt-2 space-y-0.5 text-sm">
                    {o.items.map((i) => (
                      <li key={i.id}>
                        {i.name} <span className="text-muted">× {i.qty} · {gel(i.price)}</span>
                        {!i.productId && <span className="ml-2 rounded bg-canvas px-1.5 py-0.5 text-xs text-muted">სხვა ნივთი</span>}
                      </li>
                    ))}
                  </ul>
                  {note && <p className="mt-2 whitespace-pre-line text-xs text-muted">{note}</p>}
                  {pending && o.reservedUntil && (
                    <p className="mt-2 text-xs text-muted">ჯავშანი მოქმედებს {formatDate(o.reservedUntil)}-მდე — მერე ჩანაწერი თვითონ უქმდება</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="text-lg font-bold tabular-nums">{gel(o.total)}</div>
                  {pending && (
                    <div className="flex gap-2">
                      <form action={cancelSaleAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <button className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-rose-600">გაუქმება</button>
                      </form>
                      <form action={soldAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">✓ გაიყიდა</button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {orders.length === 0 && <p className="card p-10 text-center text-muted">ამ სიაში ჩანაწერი არ არის.</p>}
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={href({ page: String(page - 1) })} className="btn btn-outline">← წინა</Link>}
          <span className="text-muted">გვერდი {page} / {pages} · სულ {total}</span>
          {page < pages && <Link href={href({ page: String(page + 1) })} className="btn btn-outline">შემდეგი →</Link>}
        </nav>
      )}
    </div>
  );
}
