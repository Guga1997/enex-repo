"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/workflow";

/**
 * თანამშრომლების ანგარიშები — მხოლოდ ადმინისტრატორისთვის.
 *
 * ადრე ეს სერვერზე ბრძანებით კეთდებოდა; აქედან ისეა, რომ ანგარიშს ბრაუზერიდან
 * ქმნი. პაროლს თვითონ აყენებ და თანამშრომელს გადასცემ — სისტემა პაროლს არსად
 * ინახავს ღიად და ეკრანზე უკან არ აჩვენებს.
 */

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "ADMIN") redirect("/admin/workflow");
  return session;
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/**
 * ველებს არასტანდარტული სახელები აქვს (staffEmail, staffName, staffPassword) —
 * "email", "name" და "password" ბრაუზერის ავტოშევსებას თავის ველებად მიაჩნია
 * და შენახული მონაცემების ჩამონათვალს სთავაზობს. აქ სხვისი ანგარიში იქმნება,
 * არა შენი შესვლა, ამიტომ ეს სია არასდროს გამოგვადგება.
 */

const back = (error?: string, ok?: string) => {
  revalidatePath("/admin/staff");
  const q = new URLSearchParams();
  if (error) q.set("error", error);
  if (ok) q.set("ok", ok);
  redirect(`/admin/staff${q.size ? `?${q}` : ""}`);
};

const isRole = (r: string): r is Role => (ROLES as readonly string[]).includes(r);

export async function createStaff(formData: FormData) {
  await requireAdmin();

  const email = str(formData, "staffEmail").toLowerCase();
  const name = str(formData, "staffName");
  const role = str(formData, "role");
  const password = str(formData, "staffPassword");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return back("email");
  if (!name) return back("name");
  if (!isRole(role)) return back("role");
  if (password.length < 10) return back("short");
  if (await db.admin.findUnique({ where: { email }, select: { id: true } })) return back("taken");

  await db.admin.create({
    data: { email, name, role, passwordHash: await bcrypt.hash(password, 10) },
  });
  return back(undefined, "created");
}

export async function updateStaff(formData: FormData) {
  const me = await requireAdmin();

  const id = str(formData, "id");
  const name = str(formData, "staffName");
  const role = str(formData, "role");
  if (!id || !name || !isRole(role)) return back("role");

  // საკუთარ თავს ადმინობას ვერ ჩამოიხსნი — თორემ პანელი დაიკეტება
  if (id === me.id && role !== "ADMIN") return back("self");

  await db.admin.update({ where: { id }, data: { name, role } });
  return back(undefined, "saved");
}

export async function setStaffPassword(formData: FormData) {
  await requireAdmin();

  const id = str(formData, "id");
  const password = str(formData, "staffPassword");
  if (!id) return back("role");
  if (password.length < 10) return back("short");

  await db.admin.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  return back(undefined, "password");
}

export async function setStaffActive(formData: FormData) {
  const me = await requireAdmin();

  const id = str(formData, "id");
  const active = str(formData, "active") === "1";
  if (!id) return back("role");
  if (id === me.id && !active) return back("self");

  await db.admin.update({ where: { id }, data: { active } });
  return back(undefined, active ? "enabled" : "disabled");
}
