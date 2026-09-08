"use client";

import { useActionState } from "react";
import { resendAction, verifyAction, type FormState } from "@/app/actions/customer";

const field =
  "w-full rounded-lg border border-line px-3 py-2.5 text-center text-lg tracking-[0.3em] outline-none focus:border-brand-500";

type Props = {
  channel: "EMAIL" | "SMS";
  target: string;
  done: boolean;
};

export default function VerifyForm({ channel, target, done }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(verifyAction, null);
  const [resendState, resend, resending] = useActionState<FormState, FormData>(resendAction, null);

  const title = channel === "EMAIL" ? "ელფოსტა" : "მობილური";
  const mine = state?.field === channel;

  if (done) {
    return (
      <div className="card space-y-1 p-6">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-emerald-700">✓ დადასტურებულია — {target}</p>
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-6">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted">კოდი გაიგზავნა: {target}</p>
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="channel" value={channel} />
        <input
          name="code"
          required
          inputMode="numeric"
          maxLength={6}
          placeholder="······"
          className={`${field} ${mine && state?.error ? "border-rose-400" : ""}`}
        />
        <button
          disabled={pending}
          className="btn btn-primary w-full hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? "მოწმდება…" : "დადასტურება"}
        </button>
      </form>

      {mine && state?.error && (
        <p className="rounded-lg bg-rose-50 p-2.5 text-sm text-rose-700">{state.error}</p>
      )}
      {resendState?.ok && (
        <p className="rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-700">{resendState.ok}</p>
      )}

      <form action={resend}>
        <input type="hidden" name="channel" value={channel} />
        <button
          disabled={resending}
          className="text-sm text-brand-600 hover:underline disabled:opacity-60"
        >
          {resending ? "იგზავნება…" : "კოდი აღარ მოვიდა — გამომიგზავნე ხელახლა"}
        </button>
      </form>
    </div>
  );
}
