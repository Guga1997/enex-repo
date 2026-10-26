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
  findUserByLogin,
  issueResetCode,
  resetPassword,
  type RegisterInput,
} from "@/lib/customer-auth";
import { rateLimit, clientIp, retryText, LIMITS } from "@/lib/rate-limit";
import { getT } from "@/lib/i18n/server";
import { createSession, verifyLogin } from "@/lib/auth";
import { homeFor } from "@/lib/workflow";

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
  const t = await getT();
  const ip = await clientIp();
  const rl = rateLimit(`register:${ip}`, LIMITS.registerPerIp.limit, LIMITS.registerPerIp.windowMs);
  if (!rl.ok) return { error: t("ძალიან ბევრი რეგისტრაცია — {0}", retryText(rl.retryAfterSec, t)) };

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
    return { error: t("პაროლები არ ემთხვევა"), field: "password2" };

  const res = await registerUser(input);
  if (!res.ok) return { error: t(res.error), field: res.field };

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
  const t = await getT();
  const userId = await getPendingUserId();
  if (!userId) return { error: t("სესიას ვადა გაუვიდა — გაიარე რეგისტრაცია თავიდან") };

  const channel = String(formData.get("channel") ?? "EMAIL") === "SMS" ? "SMS" : "EMAIL";
  const code = String(formData.get("code") ?? "");
  if (!/^\d{6}$/.test(code.trim())) return { error: t("კოდი 6 ციფრისგან შედგება"), field: channel };

  const res = await confirmCode(userId, channel, code);
  if (!res.ok) return { error: t(res.error), field: channel };

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

  return { ok: t(channel === "EMAIL" ? "ელფოსტა დადასტურდა" : "ნომერი დადასტურდა") };
}

export async function resendAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const userId = await getPendingUserId();
  if (!userId) return { error: t("სესიას ვადა გაუვიდა — გაიარე რეგისტრაცია თავიდან") };

  // ყოველი კოდი ფასიანი SMS-ია — წუთში ერთი, საათში ხუთი
  const quick = rateLimit(`resend:${userId}`, LIMITS.resendPerUser.limit, LIMITS.resendPerUser.windowMs);
  if (!quick.ok) return { error: t("კოდი ახლახან გაიგზავნა — {0}", retryText(quick.retryAfterSec, t)) };
  const hourly = rateLimit(`resend-h:${userId}`, LIMITS.resendPerUserHour.limit, LIMITS.resendPerUserHour.windowMs);
  if (!hourly.ok) return { error: t("ლიმიტი ამოიწურა — {0}", retryText(hourly.retryAfterSec, t)) };

  const channel = String(formData.get("channel") ?? "EMAIL") === "SMS" ? "SMS" : "EMAIL";
  const res = await issueCode(userId, channel);
  if (!res.ok) return { error: t(res.error) };
  return { ok: t(channel === "EMAIL" ? "ახალი კოდი ელფოსტაზე გაიგზავნა" : "ახალი კოდი SMS-ით გაიგზავნა") };
}

/* ─────────────────────────── შესვლა ─────────────────────────── */

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const login = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/account");

  // პაროლის გამოცნობის წინააღმდეგ — IP-ზეც და ანგარიშზეც
  const ip = await clientIp();
  const byIp = rateLimit(`login-ip:${ip}`, LIMITS.loginPerIp.limit, LIMITS.loginPerIp.windowMs);
  const byAcc = rateLimit(`login-acc:${login.toLowerCase().trim()}`, LIMITS.loginPerAccount.limit, LIMITS.loginPerAccount.windowMs);
  if (!byIp.ok || !byAcc.ok) {
    const sec = Math.max(byIp.ok ? 0 : byIp.retryAfterSec, byAcc.ok ? 0 : byAcc.retryAfterSec);
    return { error: t("ძალიან ბევრი მცდელობა — {0}", retryText(sec, t)) };
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

    // თანამშრომელი საიტის ჩვეულებრივ „შესვლას“ აჭერს და არა /admin/login-ს —
    // მისი სამუშაო ანგარიში მყიდველების ბაზაში არ არის, ამიტომ აქვე ვამოწმებთ
    // და პირდაპირ მის სამუშაო სიაზე ვუშვებთ
    const staff = await verifyLogin(login, password);
    if (staff) {
      await createSession(staff);
      redirect(homeFor(staff.role));
    }

    return { error: t(res.error) };
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
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/organizations");

  const name = String(formData.get("name") ?? "").trim();
  const taxId = String(formData.get("taxId") ?? "").replace(/\D/g, "");
  const address = String(formData.get("address") ?? "").trim();
  const isDefault = formData.get("isDefault") === "on";

  if (name.length < 2) return { error: t("მიუთითე დასახელება"), field: "name" };
  if (taxId.length !== 9) return { error: t("საიდენტიფიკაციო კოდი 9 ციფრისგან შედგება"), field: "taxId" };
  if (address.length < 5) return { error: t("მიუთითე იურიდიული მისამართი"), field: "address" };

  if (isDefault) {
    await db.organization.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  }
  await db.organization.create({ data: { userId: user.id, name, taxId, address, isDefault } });

  revalidatePath("/account/organizations");
  return { ok: t("ორგანიზაცია დაემატა") };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/password");

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");

  if (next.length < 8) return { error: t("ახალი პაროლი მინიმუმ 8 სიმბოლო"), field: "next" };
  if (next !== String(formData.get("next2") ?? ""))
    return { error: t("პაროლები არ ემთხვევა"), field: "next2" };
  if (!(await bcrypt.compare(current, user.passwordHash)))
    return { error: t("მიმდინარე პაროლი არასწორია"), field: "current" };

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });
  return { ok: t("პაროლი შეიცვალა") };
}

/* ─────────────────────── პაროლის აღდგენა ─────────────────────── */

const RESETTING = "resetting_user";

export async function getResettingUserId(): Promise<string | null> {
  return (await cookies()).get(RESETTING)?.value ?? null;
}

/**
 * კოდის გამოთხოვა. პასუხი ყოველთვის ერთი და იგივეა — არსებობს ანგარიში თუ არა,
 * გვერდი ამას არ ამხელს, თორემ ელფოსტების შესამოწმებელ ხელსაწყოდ იქცევა.
 */
export async function requestResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const login = String(formData.get("login") ?? "").trim();
  if (!login) return { error: t("მიუთითე ელფოსტა ან ტელეფონის ნომერი") };

  const ip = await clientIp();
  const byIp = rateLimit(`reset-ip:${ip}`, LIMITS.resetPerIp.limit, LIMITS.resetPerIp.windowMs);
  const byAcc = rateLimit(`reset-acc:${login.toLowerCase()}`, LIMITS.resetPerAccount.limit, LIMITS.resetPerAccount.windowMs);
  if (!byIp.ok || !byAcc.ok) {
    const sec = Math.max(byIp.ok ? 0 : byIp.retryAfterSec, byAcc.ok ? 0 : byAcc.retryAfterSec);
    return { error: t("ძალიან ბევრი მოთხოვნა — {0}", retryText(sec, t)) };
  }

  const user = await findUserByLogin(login);
  if (user && user.isActive) {
    await issueResetCode(user.id);
    (await cookies()).set(RESETTING, user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: PENDING_TTL,
    });
  }
  redirect("/reset");
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const userId = await getResettingUserId();
  if (!userId) return { error: t("კოდი არ არის მოთხოვნილი — დაიწყე თავიდან") };

  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("password2") ?? "");
  if (password.length < 8) return { error: t("პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს"), field: "password" };
  if (password !== repeat) return { error: t("პაროლები არ ემთხვევა"), field: "password2" };

  const res = await resetPassword(userId, code, password);
  if (!res.ok) return { error: t(res.error), field: "code" };

  (await cookies()).delete(RESETTING);

  // დადასტურებულ ანგარიშს მაშინვე შევუშვებთ; დაუდასტურებელი ჯერ ვერიფიკაციაზე მიდის
  if (isVerified(res.user)) {
    await createCustomerSession({
      id: res.user.id,
      email: res.user.email,
      name: res.user.name,
      priceTier: res.user.priceTier,
    });
    redirect("/account");
  }
  redirect("/login");
}
