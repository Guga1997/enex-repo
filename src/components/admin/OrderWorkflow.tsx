import { formatDate } from "@/lib/format";
import {
  ROLE_LABEL,
  STEP_DEFS,
  canDo,
  canSee,
  isOpen,
  type Role,
  type Step,
} from "@/lib/workflow";
import { confirmStep, saveDeliveryRequest, saveSupplierInvoice, saveWaybill } from "@/app/admin/workflow-actions";
import UploadField from "./UploadField";

/**
 * შეკვეთის პროცესი — ათი ნაბიჯი ერთ სვეტად.
 *
 * თითოეული ნაბიჯი სამ მდგომარეობაშია: შესრულებული (ვინ და როდის), მიმდინარე
 * (ფორმა, თუ ეს შენი განყოფილებაა) და მოსალოდნელი. მონაცემები მხოლოდ იმ
 * განყოფილებას უჩანს, რომელსაც ხედვის უფლება აქვს.
 */

type Fulfillment = {
  supplierName: string | null;
  supplierInvoice: string | null;
  pickupAddress: string | null;
  pickupAt: Date | null;
  weightKg: number | null;
  dimensions: string | null;
  deliveryNote: string | null;
  waybillNumber: string | null;
  waybillUrl: string | null;
} | null;

type Props = {
  orderId: string;
  role: string;
  steps: { step: string; note: string | null; byName: string | null; createdAt: Date }[];
  fulfillment: Fulfillment;
  order: { deliveryCity: string | null; deliveryAddress: string | null; customerName: string; customerPhone: string };
};

const input =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500";

export default function OrderWorkflow({ orderId, role, steps, fulfillment, order }: Props) {
  const done = new Set(steps.map((s) => s.step));
  const byStep = new Map(steps.map((s) => [s.step, s]));

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">შეკვეთის პროცესი</h2>
        <span className="text-xs text-muted">
          {ROLE_LABEL[(role as Role) in ROLE_LABEL ? (role as Role) : "ADMIN"]}
        </span>
      </div>

      <ol className="space-y-3">
        {STEP_DEFS.map((d) => {
          const record = byStep.get(d.step);
          const open = isOpen(d.step as Step, done);
          const mine = canDo(role, d.step as Step);

          return (
            <li
              key={d.step}
              className={`rounded-xl border p-4 ${
                record ? "border-line bg-canvas" : open ? "border-brand-500" : "border-line opacity-60"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    record ? "bg-emerald-500 text-white" : open ? "bg-brand-500 text-white" : "bg-line text-muted"
                  }`}
                >
                  {record ? "✓" : d.no}
                </span>
                <b className="text-sm">{d.title}</b>
                <span className="rounded bg-canvas px-2 py-0.5 text-[11px] text-muted">{ROLE_LABEL[d.role]}</span>
                {record && (
                  <span className="ml-auto text-xs text-muted">
                    {record.byName ?? "—"} · {formatDate(record.createdAt)}
                  </span>
                )}
              </div>

              {record?.note && <p className="mt-2 text-sm text-muted">{record.note}</p>}

              {/* შესრულებული ნაბიჯის მონაცემები — ხედვის უფლებით */}
              {record && d.step === "SUPPLIER_INVOICE" && canSee(role, "supplierInvoice", done) && (
                <dl className="mt-2 space-y-1 text-sm">
                  {fulfillment?.supplierName && <Row k="მომწოდებელი" v={fulfillment.supplierName} />}
                  {fulfillment?.supplierInvoice && (
                    <Row
                      k="ინვოისი"
                      v={
                        <a href={fulfillment.supplierInvoice} target="_blank" rel="noopener" className="text-brand-600 hover:underline">
                          ფაილის ნახვა ↗
                        </a>
                      }
                    />
                  )}
                </dl>
              )}
              {record && d.step === "SUPPLIER_INVOICE" && canSee(role, "pickup", done) && fulfillment?.pickupAddress && (
                <dl className="mt-1 space-y-1 text-sm">
                  <Row k="აღების მისამართი" v={fulfillment.pickupAddress} />
                  {fulfillment.pickupAt && <Row k="აღების დრო" v={formatDate(fulfillment.pickupAt)} />}
                </dl>
              )}
              {record && d.step === "DELIVERY_REQUEST" && canSee(role, "dimensions", done) && (
                <dl className="mt-2 space-y-1 text-sm">
                  {fulfillment?.weightKg && <Row k="წონა" v={`${fulfillment.weightKg} კგ`} />}
                  {fulfillment?.dimensions && <Row k="ზომები" v={fulfillment.dimensions} />}
                  {canSee(role, "customerAddress", done) && (
                    <Row
                      k="მომხმარებელი"
                      v={`${order.customerName}, ${order.customerPhone} — ${[order.deliveryCity, order.deliveryAddress]
                        .filter(Boolean)
                        .join(", ")}`}
                    />
                  )}
                </dl>
              )}
              {record && d.step === "WAYBILL" && fulfillment?.waybillNumber && (
                <dl className="mt-2 space-y-1 text-sm">
                  <Row k="ზედნადები" v={fulfillment.waybillNumber} />
                </dl>
              )}

              {/* მიმდინარე ნაბიჯი — ფორმა მხოლოდ თავის განყოფილებას */}
              {open && mine && <StepForm step={d.step as Step} orderId={orderId} order={order} fulfillment={fulfillment} />}
              {open && !mine && <p className="mt-2 text-sm text-muted">ელოდება: {ROLE_LABEL[d.role]}</p>}
              {!open && !record && <p className="mt-2 text-xs text-muted">{d.hint}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-40 shrink-0 text-muted">{k}</dt>
      <dd className="min-w-0 flex-1">{v}</dd>
    </div>
  );
}

function StepForm({
  step,
  orderId,
  order,
  fulfillment,
}: {
  step: Step;
  orderId: string;
  order: Props["order"];
  fulfillment: Fulfillment;
}) {
  if (step === "SUPPLIER_INVOICE") {
    return (
      <form action={saveSupplierInvoice} className="mt-3 space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">მომწოდებელი</span>
            <input name="supplierName" className={input} placeholder="კომპანიის სახელი" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">აღების თარიღი</span>
            <input name="pickupAt" type="datetime-local" className={input} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">აღების მისამართი (მომწოდებლის საწყობი)</span>
          <input name="pickupAddress" required className={input} placeholder="ქალაქი, ქუჩა, საწყობის ნომერი" />
        </label>
        <UploadField name="supplierInvoice" label="მომწოდებლის ინვოისი" accept=".pdf,image/*" />
        <Note />
        <button className="btn btn-primary">ატვირთვა და დადასტურება</button>
      </form>
    );
  }

  if (step === "DELIVERY_REQUEST") {
    return (
      <form action={saveDeliveryRequest} className="mt-3 space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        {fulfillment?.pickupAddress && (
          <p className="rounded-lg bg-canvas p-3 text-sm">
            <b>აღება:</b> {fulfillment.pickupAddress}
            {fulfillment.pickupAt ? ` · ${formatDate(fulfillment.pickupAt)}` : ""}
          </p>
        )}
        <p className="rounded-lg bg-canvas p-3 text-sm">
          <b>მისატანი:</b> {order.customerName}, {order.customerPhone} —{" "}
          {[order.deliveryCity, order.deliveryAddress].filter(Boolean).join(", ") || "მისამართი არ არის"}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">წონა (კგ)</span>
            <input name="weightKg" inputMode="decimal" required className={input} placeholder="12.5" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">ზომები (სმ)</span>
            <input name="dimensions" required className={input} placeholder="60×40×30" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">კურიერისთვის (არასავალდებულო)</span>
          <input name="deliveryNote" className={input} placeholder="მყიფეა, დარეკეთ მისვლამდე…" />
        </label>
        <button className="btn btn-primary">განაცხადის გაგზავნა</button>
      </form>
    );
  }

  if (step === "WAYBILL") {
    return (
      <form action={saveWaybill} className="mt-3 space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <p className="rounded-lg bg-canvas p-3 text-sm">
            <b>საიდან:</b> {fulfillment?.pickupAddress ?? "—"}
          </p>
          <p className="rounded-lg bg-canvas p-3 text-sm">
            <b>ვისთან:</b> {[order.deliveryCity, order.deliveryAddress].filter(Boolean).join(", ") || "—"}
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">ზედნადების ნომერი</span>
          <input name="waybillNumber" required className={input} placeholder="მაგ. 000123456" />
        </label>
        <UploadField name="waybillUrl" label="ზედნადების ფაილი (არასავალდებულო)" accept=".pdf,image/*" />
        <Note />
        <button className="btn btn-primary">ზედნადების დაფიქსირება</button>
      </form>
    );
  }

  return (
    <form action={confirmStep} className="mt-3 space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="step" value={step} />
      <Note />
      <button className="btn btn-primary">დადასტურება</button>
    </form>
  );
}

function Note() {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">შენიშვნა (არასავალდებულო)</span>
      <input name="note" className={input} />
    </label>
  );
}
