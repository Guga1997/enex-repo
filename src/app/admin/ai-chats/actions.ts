"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { saveChatSettings } from "@/lib/chat/settings";

/** AI ჩატის პარამეტრები: ჩართვა/გათიშვა, შეკითხვების ლიმიტი, საკონტაქტო ტექსტი. მხოლოდ ADMIN. */
export async function saveChatSettingsAction(fd: FormData) {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  if (s.role !== "ADMIN") redirect("/admin/workflow");

  const text = (k: string) => String(fd.get(k) ?? "");
  await saveChatSettings({
    enabled: fd.get("enabled") === "on",
    limit: Number(text("limit")),
    ipLimit: Number(text("ipLimit")),
    contact: { ka: text("contactKa"), en: text("contactEn"), ru: text("contactRu") },
  });
  revalidatePath("/admin/ai-chats");
  redirect("/admin/ai-chats?ok=1");
}
