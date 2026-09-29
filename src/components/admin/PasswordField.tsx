"use client";

import { useState } from "react";

/**
 * პაროლის ველი „შექმნის" ღილაკით.
 *
 * პაროლს ბრაუზერი ქმნის და ველშივე ჩანს — ასე თანამშრომელს გადასაცემი პაროლი
 * თვალწინ გაქვს, სერვერზე კი მხოლოდ დაშიფრული მიდის.
 */
export default function PasswordField({
  name = "password",
  label = "პაროლი",
  required = true,
}: {
  name?: string;
  label?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState("");
  const [shown, setShown] = useState(false);

  function generate() {
    const abc = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const buf = new Uint32Array(14);
    crypto.getRandomValues(buf);
    setValue(Array.from(buf, (n) => abc[n % abc.length]).join(""));
    setShown(true);
  }

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <div className="flex gap-2">
        <input
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          type={shown ? "text" : "password"}
          required={required}
          minLength={10}
          autoComplete="new-password"
          placeholder="მინიმუმ 10 სიმბოლო"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <button type="button" onClick={() => setShown(!shown)} className="btn btn-outline px-3 text-xs">
          {shown ? "დამალვა" : "ჩვენება"}
        </button>
        <button type="button" onClick={generate} className="btn btn-outline whitespace-nowrap px-3 text-xs">
          შექმნა
        </button>
      </div>
    </label>
  );
}
