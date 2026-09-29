import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homeFor } from "@/lib/workflow";

/**
 * თანამშრომლის შესასვლელი — enex.ge/orders.
 *
 * მოკლე, დასამახსოვრებელი მისამართი, რომელიც პირდაპირ სამუშაო სიაზე აგდებს;
 * შესვლის გარეშე — ადმინის login-ზე, და შემდეგ უკან იმავე სიაზე.
 */
export const dynamic = "force-dynamic";

export default async function OrdersEntry() {
  const session = await getSession();
  redirect(session ? homeFor(session.role) : "/admin/login?next=/admin/workflow");
}
