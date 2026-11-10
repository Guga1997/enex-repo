import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { ADMIN_AUD, authSecret } from "./auth-secret";
import { redirect } from "next/navigation";
import { ROLES, canOpen, homeFor } from "./workflow";

const COOKIE = "admin_session";
const secret = authSecret;

export type Session = { id: string; email: string; name: string; role: string };

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyLogin(email: string, password: string): Promise<Session | null> {
  const admin = await db.admin.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!admin || !admin.active) return null;
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return null;
  return { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
}

export async function createSession(session: Session) {
  const token = await new SignJWT(session as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(ADMIN_AUD)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

/**
 * თანამშრომლის სესია — ტოკენი + ბაზა. გამორთული ანგარიში მაშინვე კარგავს წვდომას,
 * როლიც ბაზიდან მოდის (როლის შეცვლა ძველ ტოკენს არ ეხება), პაროლის შეცვლა კი წინა
 * ტოკენებს აუქმებს.
 */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let payload;
  try {
    ({ payload } = await jwtVerify(token, secret(), { audience: ADMIN_AUD }));
  } catch {
    return null;
  }
  const admin = await db.admin.findUnique({ where: { id: String(payload.id) } });
  if (!admin || !admin.active || !(ROLES as readonly string[]).includes(admin.role)) return null;
  if (admin.passwordChangedAt && (payload.iat ?? 0) * 1000 < admin.passwordChangedAt.getTime() - 1000) return null;
  return { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/**
 * ადმინის გვერდის დასაწყისში: სესია ბაზით მოწმდება (გამორთული/როლშეცვლილი თანამშრომელი
 * მაშინვე კარგავს წვდომას — middleware მხოლოდ ტოკენს ხედავს) და როლს ამ გვერდის ნახვის უფლება აქვს.
 */
export async function requireStaff(path: string): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!canOpen(session.role, path)) redirect(homeFor(session.role));
  return session;
}
