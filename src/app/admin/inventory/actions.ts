"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { setOwnStock } from "@/lib/inventory";

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "ADMIN") redirect("/admin/workflow");
  return session;
}

export async function saveOwnStock(productId: string, ownQty: number, note: string): Promise<{ error?: string }> {
  const session = await requireAdmin();
  if (!Number.isInteger(ownQty) || ownQty < 0) return { error: "მარაგი მთელი, არაუარყოფითი რიცხვი უნდა იყოს" };
  await setOwnStock(productId, ownQty, `ადმინი: ${session.name}`, note.slice(0, 200));
  revalidatePath("/admin/inventory");
  return {};
}
