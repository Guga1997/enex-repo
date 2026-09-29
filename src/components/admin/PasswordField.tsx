"use client";

import { useState } from "react";

/**
 * თანამშრომლის პაროლის დაყენება — „შექმნა" ღილაკით.
 *
 * ეს არ არის შესვლის ველი: აქ სხვისი პაროლი იწერება და თვალით უნდა ნახო, სანამ
 * გადასცემ. ამიტომ ველი ჩვეულებრივი ტექსტია და დამალვა CSS-ით ხდება — გვერდზე
 * `type="password"` საერთოდ არ არის, რომ ბრაუზერის პაროლების შემნახველმა და
 * ავტოშევსებამ ამ ფორმას არ მიხედოს (შენახვის შეთავაზება, უცხო მონაცემების
 * ჩასმა და კრახი ამ ველზე კრეფისას სწორედ იქიდან მოდის).
 */
export default function PasswordField({
  name = "staffPassword",
  label = "პაროლი",
  required = true,
}: {
  name?: string;
  label?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState("");
  const [shown, setShown] = useState(true);

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
          type="text"
          required={required}
          minLength={10}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore=""
          data-form-type="other"
          placeholder="მინიმუმ 10 სიმბოლო"
          style={shown ? undefined : ({ WebkitTextSecurity: "disc" } as React.CSSProperties)}
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
