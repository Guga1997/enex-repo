import Link from "next/link";
import { getCurrentUser } from "@/lib/customer-auth";

export default async function AccountButton() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href="/login" className="rounded-lg px-3 py-2 hover:bg-canvas">
        შესვლა
      </Link>
    );
  }

  const short = user.name.length > 18 ? `${user.name.slice(0, 18)}…` : user.name;

  return (
    <Link
      href="/account"
      className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-canvas"
      title={user.name}
    >
      <span className="hidden sm:inline">{short}</span>
      <span className="sm:hidden">ჩემი ანგარიში</span>
      {user.priceTier === "DEALER" && (
        <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[11px] font-medium text-white">
          დილერი
        </span>
      )}
    </Link>
  );
}
