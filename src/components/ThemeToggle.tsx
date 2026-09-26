"use client";

import { useT } from "@/components/LocaleProvider";

/**
 * დღე/ღამე გადამრთველი.
 *
 * არჩევანი localStorage-შია და <head>-ის სკრიპტი კლასს ხატვამდე აყენებს —
 * ამიტომ გვერდის გახსნისას თეთრი ციმციმი არ ხდება. ღილაკს React-ული
 * მდგომარეობა არ სჭირდება: რომელი ხატულა ჩანს, CSS-ით წყდება (dark:),
 * ამიტომ სერვერისა და ბრაუზერის HTML ყოველთვის ემთხვევა.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const t = useT();
  function toggle() {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      /* ინკოგნიტო რეჟიმში წერა შეიძლება აკრძალული იყოს — რეჟიმი მაინც გადაირთვება */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("დღის/ღამის რეჟიმი")}
      title={t("დღის/ღამის რეჟიმი")}
      className={`flex size-9 items-center justify-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-5 dark:hidden" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
      </svg>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="hidden size-5 dark:block" aria-hidden>
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
      </svg>
    </button>
  );
}
