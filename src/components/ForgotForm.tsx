"use client";

import { useActionState } from "react";
import { requestResetAction, type FormState } from "@/app/actions/customer";

const field =
  "w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500";

/** პაროლის აღდგენის პირველი ნაბიჯი — კოდის გამოთხოვა */
export default function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestResetAction, null);

  return (
    <form action={action} className="card space-y-4 p-6 sm:p-8">
      <h1 className="text-xl font-bold">პაროლის აღდგენა</h1>
      <p className="text-sm text-muted">
        მიუთითე ელფოსტა ან ტელეფონის ნომერი — კოდს ორივეზე გამოგიგზავნით.
      </p>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">ელფოსტა ან ტელეფონი</span>
        <input
          name="login"
          required
          autoComplete="username"
          placeholder="mail@example.ge ან 5XX XX XX XX"
          className={field}
        />
      </label>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{state.error}</p>
      )}

      <button disabled={pending} className="btn btn-primary w-full hover:bg-brand-600">
        {pending ? "იგზავნება…" : "კოდის გამოგზავნა"}
      </button>
    </form>
  );
}
