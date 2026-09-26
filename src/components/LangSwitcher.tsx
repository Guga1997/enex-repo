"use client";

import { useSearchParams } from "next/navigation";
import { LOCALES, LOCALE_LABEL, LOCALE_NAME, withLocale, type Locale } from "@/lib/i18n/config";
import { useLocale, usePath } from "./LocaleProvider";

/**
 * ენის გადამრთველი — სამი ღილაკი ერთ ჩარჩოში.
 * იმავე გვერდზე რჩება, მხოლოდ მისამართის პრეფიქსი იცვლება.
 * usePath მისამართს პრეფიქსის გარეშე აბრუნებს, ამიტომ უბრალოდ ახალს ვადებთ.
 */
export default function LangSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePath();
  const qs = useSearchParams().toString();

  return (
    <div className={`flex items-center rounded-lg border border-line p-0.5 ${className}`}>
      {LOCALES.map((l: Locale) => (
        <a
          key={l}
          href={withLocale(pathname, l) + (qs ? `?${qs}` : "")}
          hrefLang={l}
          title={LOCALE_NAME[l]}
          aria-current={l === locale ? "true" : undefined}
          className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase transition ${
            l === locale ? "bg-brand-500 text-white" : "text-muted hover:text-ink"
          }`}
        >
          {LOCALE_LABEL[l]}
        </a>
      ))}
    </div>
  );
}
