"use client";

import { useActionState, useState } from "react";
import Link from "@/components/Link";
import { registerAction, type FormState } from "@/app/actions/customer";
import { useT } from "@/components/LocaleProvider";

const field =
  "w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500";

type Kind = "INDIVIDUAL" | "COMPANY";

export default function RegisterForm({ next }: { next?: string }) {
  const t = useT();
  const [type, setType] = useState<Kind>("INDIVIDUAL");
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, null);

  const isCompany = type === "COMPANY";
  const err = (name: string) => state?.field === name;

  return (
    <form action={action} className="card space-y-5 p-6 sm:p-8">
      <div>
        <h1 className="text-xl font-bold">{t("რეგისტრაცია")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("დარეგისტრირებული მომხმარებელი ხედავს თავის ფასს და შეკვეთების ისტორიას.")}
        </p>
      </div>

      {/* ფიზიკური თუ იურიდიული — ველების დასახელება ამაზეა დამოკიდებული */}
      <div className="grid grid-cols-2 gap-2">
        {(["INDIVIDUAL", "COMPANY"] as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setType(k)}
            className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
              type === k
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-line bg-surface text-ink hover:bg-canvas"
            }`}
          >
            {k === "INDIVIDUAL" ? "ფიზიკური პირი" : "იურიდიული პირი"}
          </button>
        ))}
      </div>
      <input type="hidden" name="type" value={type} />
      {next && <input type="hidden" name="next" value={next} />}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          {isCompany ? "კომპანიის დასახელება" : "სახელი და გვარი"}
        </span>
        <input
          name="name"
          required
          className={`${field} ${err("name") ? "border-rose-400" : ""}`}
          placeholder={isCompany ? "შპს ინდექსი" : "გიორგი ნიშნიანიძე"}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          {isCompany ? "საიდენტიფიკაციო კოდი" : "პირადი ნომერი"}
        </span>
        <input
          name="taxId"
          required
          inputMode="numeric"
          maxLength={isCompany ? 9 : 11}
          className={`${field} ${err("taxId") ? "border-rose-400" : ""}`}
          placeholder={isCompany ? "9 ციფრი" : "11 ციფრი"}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{t("ფიზიკური მისამართი")}</span>
        <input
          name="address"
          required
          className={`${field} ${err("address") ? "border-rose-400" : ""}`}
          placeholder={t("თბილისი, თერგვაძის 42")}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t("ელფოსტა")}</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={`${field} ${err("email") ? "border-rose-400" : ""}`}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t("საკონტაქტო ტელეფონი")}</span>
          <input
            name="phone"
            required
            inputMode="tel"
            autoComplete="tel"
            className={`${field} ${err("phone") ? "border-rose-400" : ""}`}
            placeholder="5XXXXXXXX"
          />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t("პაროლი")}</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={`${field} ${err("password") ? "border-rose-400" : ""}`}
            placeholder={t("მინიმუმ 8 სიმბოლო")}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t("გაიმეორე პაროლი")}</span>
          <input
            name="password2"
            type="password"
            required
            autoComplete="new-password"
            className={`${field} ${err("password2") ? "border-rose-400" : ""}`}
          />
        </label>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{state.error}</p>
      )}

      <p className="text-sm text-muted">
        რეგისტრაციის შემდეგ ორ კოდს მიიღებ — ერთს ელფოსტაზე, მეორეს SMS-ით. ანგარიში
        ორივეს დადასტურების შემდეგ ამოქმედდება.
      </p>

      <button disabled={pending} className="btn btn-primary w-full hover:bg-brand-600 disabled:opacity-60">
        {pending ? "იგზავნება…" : "რეგისტრაცია"}
      </button>

      <p className="text-center text-sm text-muted">
        უკვე გაქვს ანგარიში?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-brand-600 hover:underline">
          {t("შესვლა")}
        </Link>
      </p>
    </form>
  );
}
