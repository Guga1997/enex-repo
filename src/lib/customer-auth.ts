import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { db } from "./db";
import { sendEmail } from "./notify/email";
import { sendSms, normalizeGeoPhone } from "./notify/sms";

const COOKIE = "user_session";
const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

const secret = () =>
  new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me!!");

export type CustomerSession = { id: string; email: string; name: string; priceTier: string };

/* ───────────────────────── სესია ───────────────────────── */

export async function createCustomerSession(s: CustomerSession) {
  const token = await new SignJWT(s as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: String(payload.id),
      email: String(payload.email),
      name: String(payload.name),
      priceTier: String(payload.priceTier),
    };
  } catch {
    return null;
  }
}

export async function destroyCustomerSession() {
  (await cookies()).delete(COOKIE);
}

/** სესიის მიღმა მდგარი ცოცხალი ჩანაწერი — ფასის დონე ყოველთვის ბაზიდან */
export async function getCurrentUser() {
  const s = await getCustomerSession();
  if (!s) return null;
  const user = await db.user.findUnique({ where: { id: s.id } });
  return user?.isActive ? user : null;
}

/* ─────────────────────── რეგისტრაცია ─────────────────────── */

export type RegisterInput = {
  type: "INDIVIDUAL" | "COMPANY";
  name: string;
  taxId: string;
  address: string;
  email: string;
  phone: string;
  password: string;
};

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; field?: keyof RegisterInput };

export function validateRegistration(input: RegisterInput): { error: string; field?: keyof RegisterInput } | null {
  const name = input.name.trim();
  if (name.length < 2)
    return { error: input.type === "COMPANY" ? "მიუთითე კომპანიის დასახელება" : "მიუთითე სახელი და გვარი", field: "name" };

  const taxId = input.taxId.replace(/\D/g, "");
  // ფიზიკურ პირს 11-ნიშნა პირადი ნომერი აქვს, იურიდიულს — 9-ნიშნა საიდენტიფიკაციო კოდი
  if (input.type === "INDIVIDUAL" && taxId.length !== 11)
    return { error: "პირადი ნომერი 11 ციფრისგან უნდა შედგებოდეს", field: "taxId" };
  if (input.type === "COMPANY" && taxId.length !== 9)
    return { error: "საიდენტიფიკაციო კოდი 9 ციფრისგან უნდა შედგებოდეს", field: "taxId" };

  if (input.address.trim().length < 5) return { error: "მიუთითე ფიზიკური მისამართი", field: "address" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim()))
    return { error: "ელფოსტის მისამართი არასწორია", field: "email" };
  if (!normalizeGeoPhone(input.phone))
    return { error: "ტელეფონი ფორმატში 5XXXXXXXX", field: "phone" };
  if (input.password.length < 8) return { error: "პაროლი მინიმუმ 8 სიმბოლო", field: "password" };
  return null;
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const invalid = validateRegistration(input);
  if (invalid) return { ok: false, ...invalid };

  const email = input.email.toLowerCase().trim();
  const phone = normalizeGeoPhone(input.phone)!;

  const clash = await db.user.findFirst({ where: { OR: [{ email }, { phone }] } });
  if (clash)
    return clash.email === email
      ? { ok: false, error: "ამ ელფოსტით ანგარიში უკვე არსებობს", field: "email" }
      : { ok: false, error: "ამ ნომრით ანგარიში უკვე არსებობს", field: "phone" };

  const user = await db.user.create({
    data: {
      email,
      phone,
      passwordHash: await bcrypt.hash(input.password, 10),
      type: input.type,
      name: input.name.trim(),
      taxId: input.taxId.replace(/\D/g, ""),
      address: input.address.trim(),
    },
  });

  await Promise.all([issueCode(user.id, "EMAIL"), issueCode(user.id, "SMS")]);
  return { ok: true, userId: user.id };
}

/* ─────────────────────── ვერიფიკაცია ─────────────────────── */

/** ახალი კოდი; ძველი იმავე არხზე ბათილდება, რომ ორი ერთდროულად არ მუშაობდეს */
export async function issueCode(userId: string, channel: "EMAIL" | "SMS") {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false as const, error: "მომხმარებელი ვერ მოიძებნა" };

  await db.verificationCode.updateMany({
    where: { userId, channel, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.verificationCode.create({
    data: {
      userId,
      channel,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000),
    },
  });

  if (channel === "EMAIL") {
    await sendEmail({
      to: user.email,
      subject: `დადასტურების კოდი: ${code}`,
      html: `<p>გამარჯობა, ${user.name}.</p>
             <p>ელფოსტის დასადასტურებელი კოდია <b style="font-size:20px">${code}</b>.</p>
             <p>კოდი ${CODE_TTL_MIN} წუთის განმავლობაშია ძალაში.</p>`,
    });
  } else {
    await sendSms(user.phone, `დადასტურების კოდი: ${code}. ძალაშია ${CODE_TTL_MIN} წუთი.`);
  }

  return { ok: true as const };
}

export async function confirmCode(userId: string, channel: "EMAIL" | "SMS", code: string) {
  const row = await db.verificationCode.findFirst({
    where: { userId, channel, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false as const, error: "კოდი არ არის მოთხოვნილი — გამოითხოვე ახალი" };
  if (row.expiresAt < new Date()) return { ok: false as const, error: "კოდს ვადა გაუვიდა — გამოითხოვე ახალი" };
  if (row.attempts >= MAX_ATTEMPTS)
    return { ok: false as const, error: "ცდების ლიმიტი ამოიწურა — გამოითხოვე ახალი კოდი" };

  const ok = await bcrypt.compare(code.trim(), row.codeHash);
  if (!ok) {
    await db.verificationCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { ok: false as const, error: "კოდი არასწორია" };
  }

  await db.verificationCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  await db.user.update({
    where: { id: userId },
    data: channel === "EMAIL" ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() },
  });
  return { ok: true as const };
}

export const isVerified = (u: { emailVerifiedAt: Date | null; phoneVerifiedAt: Date | null }) =>
  Boolean(u.emailVerifiedAt && u.phoneVerifiedAt);

/* ─────────────────────────── შესვლა ─────────────────────────── */

export async function verifyCustomerLogin(login: string, password: string) {
  const value = login.toLowerCase().trim();
  const phone = normalizeGeoPhone(login);
  const user = await db.user.findFirst({
    where: { OR: [{ email: value }, ...(phone ? [{ phone }] : [])] },
  });
  if (!user || !user.isActive) return { ok: false as const, error: "მონაცემები არასწორია" };
  if (!(await bcrypt.compare(password, user.passwordHash)))
    return { ok: false as const, error: "მონაცემები არასწორია" };
  if (!isVerified(user))
    return { ok: false as const, error: "ანგარიში დადასტურებული არ არის", userId: user.id };
  return { ok: true as const, user };
}
