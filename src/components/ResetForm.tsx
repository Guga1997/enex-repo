"use client";

import { useActionState } from "react";
import Link from "@/components/Link";
import { resetPasswordAction, type FormState } from "@/app/actions/customer";
import { useT } from "@/components/LocaleProvider";

const field =
  "w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500";

/** მეორე ნაბიჯი — კოდი და ახალი პაროლი ერთად, რომ კოდი შუაში არ დაიკარგოს */
export default function ResetForm() {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, null);

  return (
    <form action={action} className="card space-y-4 p-6 sm:p-8">
      <h1 className="text-xl font-bold">{t("ახალი პაროლი")}</h1>
      <p className="text-sm text-muted">
        {t("თუ ასეთი ანგარიში არსებობს, კოდი ელფოსტაზეც და SMS-ითაც გაიგზავნა. კოდი 10 წუთია ძალაში.")}
      </p>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("კოდი")}</span>
        <input
          name="code"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className={`${field} tracking-[0.3em]`}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("ახალი პაროლი")}</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder={t("მინიმუმ 8 სიმბოლო")}
          className={field}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("გაიმეორე პაროლი")}</span>
        <input name="password2" type="password" required autoComplete="new-password" className={field} />
      </label>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{state.error}</p>
      )}

      <button disabled={pending} className="btn btn-primary w-full hover:bg-brand-600">
        {pending ? t("ინახება…") : t("პაროლის შეცვლა")}
      </button>

      <p className="text-center text-sm text-muted">
        {t("კოდი არ მოვიდა?")}{" "}
        <Link href="/forgot" className="font-medium text-brand-600 hover:underline">
          {t("ხელახლა გამოთხოვე")}
        </Link>
      </p>
    </form>
  );
}
