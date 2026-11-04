"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { clearStockAdjust, setStock } from "@/lib/inventory";

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "ADMIN") redirect("/admin/workflow");
  return session;
}

export async function saveStock(productId: string, target: number, note: string): Promise<{ error?: string }> {
  const session = await requireAdmin();
  if (!Number.isInteger(target) || target < 0) return { error: "ნაშთი მთელი, არაუარყოფითი რიცხვი უნდა იყოს" };
  await setStock(productId, target, `ადმინი: ${session.name}`, note.slice(0, 200));
  revalidatePath("/admin/inventory");
  return {};
}

export async function resetAdjust(formData: FormData) {
  const session = await requireAdmin();
  await clearStockAdjust(String(formData.get("id")), `ადმინი: ${session.name}`);
  revalidatePath("/admin/inventory");
}
