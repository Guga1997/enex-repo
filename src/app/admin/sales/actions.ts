"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { cancelStoreSale, createStaffOrder, markStoreSold, type StaffInvoiceResult } from "@/lib/staff-order";

/** მაღაზიის გაყიდვის მომზადება — შეკვეთა ინახება „მომზადებულად“, ნაშთი იკავება */
export async function createSale(payload: unknown): Promise<StaffInvoiceResult> {
  const session = await requireStaff("/admin/sales");
  const data = typeof payload === "object" && payload !== null ? payload : {};
  const r = await createStaffOrder({ ...data, kind: "STORE", sendEmail: false }, { name: session.name });
  if (r.ok) revalidatePath("/admin/sales");
  return r;
}

const back = (msg: { ok?: string; error?: string }) =>
  redirect(`/admin/sales?${new URLSearchParams(msg as Record<string, string>)}`);

/** „გაიყიდა“ — ფული მიღებულია: ნაშთი ჩამოიწერება */
export async function soldAction(formData: FormData) {
  await requireStaff("/admin/sales");
  const r = await markStoreSold(String(formData.get("id") ?? ""));
  revalidatePath("/admin/sales");
  back(r.ok ? { ok: "გაყიდვა დადასტურდა — ნაშთი ჩამოიწერა" } : { error: r.error });
}

export async function cancelSaleAction(formData: FormData) {
  await requireStaff("/admin/sales");
  const r = await cancelStoreSale(String(formData.get("id") ?? ""));
  revalidatePath("/admin/sales");
  back(r.ok ? { ok: "გაყიდვა გაუქმდა — ჯავშანი მოიხსნა" } : { error: r.error });
}
