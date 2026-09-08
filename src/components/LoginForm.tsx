"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/actions/customer";

const field =
  "w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500";

export default function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, null);

  return (
    <form action={action} className="card space-y-4 p-6 sm:p-8">
      <h1 className="text-xl font-bold">შესვლა</h1>

      <input type="hidden" name="next" value={next ?? "/account"} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">ელფოსტა ან ტელეფონი</span>
        <input name="login" required autoComplete="username" className={field} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">პაროლი</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={field}
        />
      </label>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{state.error}</p>
      )}

      <button
        disabled={pending}
        className="btn btn-primary w-full hover:bg-brand-600 disabled:opacity-60"
      >
        {pending ? "მოწმდება…" : "შესვლა"}
      </button>
    </form>
  );
}
