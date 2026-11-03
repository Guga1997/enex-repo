import Link from "@/components/Link";
import { getCurrentUser } from "@/lib/customer-auth";
import { getT } from "@/lib/i18n/server";

export default async function AccountButton() {
  const t = await getT();
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href="/login" className="rounded-lg px-2 py-2 hover:bg-canvas sm:px-3">
        {t("შესვლა")}
      </Link>
    );
  }

  const short = user.name.length > 18 ? `${user.name.slice(0, 18)}…` : user.name;

  return (
    <Link
      href="/account"
      className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-canvas sm:px-3"
      title={user.name}
    >
      <span className="hidden sm:inline">{short}</span>
      {/* ტელეფონზე ჰედერში ადგილი არ არის — მხოლოდ ხატულა */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-5 sm:hidden" aria-label={t("ჩემი ანგარიში")}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
      </svg>
      {user.priceTier === "DEALER" && (
        <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[11px] font-medium text-white">
          {t("დილერი")}
        </span>
      )}
    </Link>
  );
}
