"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useT } from "@/components/LocaleProvider";
import { withLocale } from "@/lib/i18n/config";

/**
 * ძებნის ველი უმართავია (defaultValue, მნიშვნელობა გაგზავნისას იკითხება): React-ის
 * მართული ველი ტელეფონის კლავიატურის „შედგენას“ (ქართული, ავტოშევსება, შეთავაზებები)
 * ეჯახებოდა და ასოები/ციფრები ორდებოდა ან ემატებოდა. ავტოშევსება და ავტოკორექცია
 * გამორთულია — მოდელის კოდებს (DH-IPC-HFW2441) კლავიატურა არ უნდა „ასწორებდეს“.
 */
export default function SearchBox() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const current = useSearchParams().get("q") ?? "";

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        (e.currentTarget.elements.namedItem("q") as HTMLInputElement | null)?.blur();
        router.push(withLocale(q ? `/catalog?q=${encodeURIComponent(q)}` : "/catalog", locale));
      }}
      className="relative"
    >
      <input
        // ახალ ძებნაზე (სხვა ?q=) ველი გვერდის მნიშვნელობას იღებს
        key={current}
        name="q"
        defaultValue={current}
        placeholder={t("ძებნა დასახელებით, მოდელით ან კოდით...")}
        aria-label={t("ძებნა")}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="w-full rounded-lg border border-line bg-canvas py-2.5 pl-4 pr-11 text-base outline-none focus:border-brand-500 focus:bg-surface sm:text-sm"
      />
      <button
        type="submit"
        aria-label={t("ძებნა")}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted hover:text-brand-600"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </form>
  );
}
