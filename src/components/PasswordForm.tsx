"use client";

import { useActionState } from "react";
import { changePasswordAction, type FormState } from "@/app/actions/customer";
import { useT } from "@/components/LocaleProvider";

const field =
  "w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500";

export default function PasswordForm() {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, null);

  return (
    <form action={action} className="card max-w-md space-y-4 p-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("მიმდინარე პაროლი")}</span>
        <input name="current" type="password" required autoComplete="current-password" className={field} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("ახალი პაროლი")}</span>
        <input
          name="next"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={field}
          placeholder={t("მინიმუმ 8 სიმბოლო")}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("გაიმეორე ახალი პაროლი")}</span>
        <input name="next2" type="password" required autoComplete="new-password" className={field} />
      </label>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{state.ok}</p>
      )}

      <button disabled={pending} className="btn btn-primary hover:bg-brand-600 disabled:opacity-60">
        {pending ? "ინახება…" : "შენახვა"}
      </button>
    </form>
  );
}
