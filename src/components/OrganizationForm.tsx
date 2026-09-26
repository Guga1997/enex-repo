"use client";

import { useActionState, useState } from "react";
import { addOrganizationAction, type FormState } from "@/app/actions/customer";
import { useT } from "@/components/LocaleProvider";

const field =
  "w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500";

export default function OrganizationForm() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(addOrganizationAction, null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-primary hover:bg-brand-600">
        {t("ორგანიზაციის დამატება")}
      </button>
    );
  }

  return (
    <form action={action} className="card space-y-4 p-4">
      <p className="font-medium">{t("ახალი ორგანიზაცია")}</p>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("დასახელება")}</span>
        <input name="name" required className={field} placeholder={t("შპს ინდექსი")} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("საიდენტიფიკაციო კოდი")}</span>
        <input name="taxId" required inputMode="numeric" maxLength={9} className={field} placeholder={t("9 ციფრი")} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("იურიდიული მისამართი")}</span>
        <input name="address" required className={field} />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDefault" className="h-4 w-4 rounded border-line" />
        {t("ნაგულისხმევად გამოყენება")}
      </label>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{state.error}</p>
      )}

      <div className="flex gap-2">
        <button disabled={pending} className="btn btn-primary hover:bg-brand-600 disabled:opacity-60">
          {pending ? "ინახება…" : "დამატება"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn">
          {t("გაუქმება")}
        </button>
      </div>
    </form>
  );
}
