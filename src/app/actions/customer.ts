"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  confirmCode,
  createCustomerSession,
  destroyCustomerSession,
  getCurrentUser,
  isVerified,
  issueCode,
  registerUser,
  verifyCustomerLogin,
  type RegisterInput,
} from "@/lib/customer-auth";
import { rateLimit, clientIp, retryText, LIMITS } from "@/lib/rate-limit";

const PENDING = "pending_user";
const AFTER_LOGIN = "after_login";
const PENDING_TTL = 60 * 30;

/** მხოლოდ საიტის შიდა გზა — გარე მისამართზე გადამისამართება არ უნდა მოხდეს */
const safeNext = (v: unknown) => {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "";
};

export type FormState = { error?: string; field?: string; ok?: string } | null;

/** დასადასტურებელი ანგარიში cookie-ში ინახება — id URL-ში არ გადის */
async function setPending(userId: string) {
  (await cookies()).set(PENDING, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_TTL,
  });
}

export async function getPendingUserId(): Promise<string | null> {
  return (await cookies()).get(PENDING)?.value ?? null;
}

async function clearPending() {
  (await cookies()).delete(PENDING);
}

/* ─────────────────────── რეგისტრაცია ─────────────────────── */

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  const rl = rateLimit(`register:${ip}`, LIMITS.registerPerIp.limit, LIMITS.registerPerIp.windowMs);
  if (!rl.ok) return { error: `ძალიან ბევრი რეგისტრაცია — ${retryText(rl.retryAfterSec)}` };

  const type = String(formData.get("type") ?? "INDIVIDUAL");
  const input: RegisterInput = {
    type: type === "COMPANY" ? "COMPANY" : "INDIVIDUAL",
    name: String(formData.get("name") ?? ""),
    taxId: String(formData.get("taxId") ?? ""),
    address: String(formData.get("address") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  if (input.password !== String(formData.get("password2") ?? ""))
    return { error: "პაროლები არ ემთხვევა", field: "password2" };

  const res = await registerUser(input);
  if (!res.ok) return { error: res.error, field: res.field };

  // იურიდიულ პირს პირველი ორგანიზაცია თავისივე რეკვიზიტებით ეხსნება
  if (input.type === "COMPANY") {
    await db.organization.create({
      data: {
        userId: res.userId,
        name: input.name.trim(),
        taxId: input.taxId.replace(/\D/g, ""),
        address: input.address.trim(),
        isDefault: true,
      },
    });
  }

  await setPending(res.userId);
  const next = safeNext(formData.get("next"));
  if (next) {
    (await cookies()).set(AFTER_LOGIN, next, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: PENDING_TTL,
    });
  }
  redirect("/verify");
}

/* ─────────────────────── ვერიფიკაცია ─────────────────────── */

export async function verifyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await getPendingUserId();
  if (!userId) return { error: "სესიას ვადა გაუვიდა — გაიარე რეგისტრაცია თავიდან" };

  const channel = String(formData.get("channel") ?? "EMAIL") === "SMS" ? "SMS" : "EMAIL";
  const code = String(formData.get("code") ?? "");
  if (!/^\d{6}$/.test(code.trim())) return { error: "კოდი 6 ციფრისგან შედგება", field: channel };

  const res = await confirmCode(userId, channel, code);
  if (!res.ok) return { error: res.error, field: channel };

  const user = await db.user.findUnique({ where: { id: userId } });
  if (user && isVerified(user)) {
    await clearPending();
    await createCustomerSession({
      id: user.id,
      email: user.email,
      name: user.name,
      priceTier: user.priceTier,
    });
    // რეგისტრაცია კალათიდან დაიწყო? — უკან checkout-ზე, არა კაბინეტში
    const jar = await cookies();
    const after = safeNext(jar.get(AFTER_LOGIN)?.value);
    jar.delete(AFTER_LOGIN);
    redirect(after || "/account");
  }

  return { ok: channel === "EMAIL" ? "ელფოსტა დადასტურდა" : "ნომერი დადასტურდა" };
}

export async function resendAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await getPendingUserId();
  if (!userId) return { error: "სესიას ვადა გაუვიდა — გაიარე რეგისტრაცია თავიდან" };

  // ყოველი კოდი ფასიანი SMS-ია — წუთში ერთი, საათში ხუთი
  const quick = rateLimit(`resend:${userId}`, LIMITS.resendPerUser.limit, LIMITS.resendPerUser.windowMs);
  if (!quick.ok) return { error: `კოდი ახლახან გაიგზავნა — ${retryText(quick.retryAfterSec)}` };
  const hourly = rateLimit(`resend-h:${userId}`, LIMITS.resendPerUserHour.limit, LIMITS.resendPerUserHour.windowMs);
  if (!hourly.ok) return { error: `ლიმიტი ამოიწურა — ${retryText(hourly.retryAfterSec)}` };

  const channel = String(formData.get("channel") ?? "EMAIL") === "SMS" ? "SMS" : "EMAIL";
  const res = await issueCode(userId, channel);
  if (!res.ok) return { error: res.error };
  return { ok: channel === "EMAIL" ? "ახალი კოდი ელფოსტაზე გაიგზავნა" : "ახალი კოდი SMS-ით გაიგზავნა" };
}

/* ─────────────────────────── შესვლა ─────────────────────────── */

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const login = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/account");

  // პაროლის გამოცნობის წინააღმდეგ — IP-ზეც და ანგარიშზეც
  const ip = await clientIp();
  const byIp = rateLimit(`login-ip:${ip}`, LIMITS.loginPerIp.limit, LIMITS.loginPerIp.windowMs);
  const byAcc = rateLimit(`login-acc:${login.toLowerCase().trim()}`, LIMITS.loginPerAccount.limit, LIMITS.loginPerAccount.windowMs);
  if (!byIp.ok || !byAcc.ok) {
    const sec = Math.max(byIp.ok ? 0 : byIp.retryAfterSec, byAcc.ok ? 0 : byAcc.retryAfterSec);
    return { error: `ძალიან ბევრი მცდელობა — ${retryText(sec)}` };
  }

  const res = await verifyCustomerLogin(login, password);
  if (!res.ok) {
    // დაუდასტურებელს ვერიფიკაციაზე ვაბრუნებთ, ახალი კოდებით
    if (res.userId) {
      await setPending(res.userId);
      // დაუდასტურებელი ანგარიშით შესვლა კოდებს თავიდან აგზავნის — იმავე ლიმიტით,
      // რაც „ხელახლა გაგზავნას“, თორემ ეს SMS-ის ბალანსის გამოცლის გზაა
      const quick = rateLimit(`resend:${res.userId}`, LIMITS.resendPerUser.limit, LIMITS.resendPerUser.windowMs);
      if (quick.ok) {
        await Promise.all([issueCode(res.userId, "EMAIL"), issueCode(res.userId, "SMS")]);
      }
      redirect("/verify");
    }
    return { error: res.error };
  }

  await createCustomerSession({
    id: res.user.id,
    email: res.user.email,
    name: res.user.name,
    priceTier: res.user.priceTier,
  });
  redirect(next.startsWith("/") ? next : "/account");
}

export async function logoutAction() {
  await destroyCustomerSession();
  redirect("/");
}

/* ─────────────────────────── კაბინეტი ─────────────────────────── */

export async function toggleFavoriteAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/favorites");

  const productId = String(formData.get("productId") ?? "");
  if (!productId) return;

  const existing = await db.favorite.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
  });

  if (existing) await db.favorite.delete({ where: { id: existing.id } });
  else await db.favorite.create({ data: { userId: user.id, productId } });
}

export async function setNewsletterAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await db.user.update({
    where: { id: user.id },
    data: { newsletter: formData.get("newsletter") === "on" },
  });
}

export async function addOrganizationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/organizations");

  const name = String(formData.get("name") ?? "").trim();
  const taxId = String(formData.get("taxId") ?? "").replace(/\D/g, "");
  const address = String(formData.get("address") ?? "").trim();
  const isDefault = formData.get("isDefault") === "on";

  if (name.length < 2) return { error: "მიუთითე დასახელება", field: "name" };
  if (taxId.length !== 9) return { error: "საიდენტიფიკაციო კოდი 9 ციფრისგან შედგება", field: "taxId" };
  if (address.length < 5) return { error: "მიუთითე იურიდიული მისამართი", field: "address" };

  if (isDefault) {
    await db.organization.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  }
  await db.organization.create({ data: { userId: user.id, name, taxId, address, isDefault } });

  revalidatePath("/account/organizations");
  return { ok: "ორგანიზაცია დაემატა" };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/password");

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");

  if (next.length < 8) return { error: "ახალი პაროლი მინიმუმ 8 სიმბოლო", field: "next" };
  if (next !== String(formData.get("next2") ?? ""))
    return { error: "პაროლები არ ემთხვევა", field: "next2" };
  if (!(await bcrypt.compare(current, user.passwordHash)))
    return { error: "მიმდინარე პაროლი არასწორია", field: "current" };

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });
  return { ok: "პაროლი შეიცვალა" };
}
