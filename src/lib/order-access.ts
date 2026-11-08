import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getSession } from "./auth";
import { getCurrentUser } from "./customer-auth";

/**
 * ვის შეუძლია შეკვეთის გვერდის / ინვოისის ნახვა (სახელი, ტელეფონი, მისამართი ჩანს):
 *   - შეკვეთის მფლობელს (შესულ მყიდველს);
 *   - თანამშრომელს;
 *   - ვინც „შეკვეთის მოძებნაში“ ნომერი და ელფოსტა სწორად შეიყვანა (ხელმოწერილი cookie, 1 დღე).
 * შეკვეთის id მარტო აღარ კმარა — ადრე ბმულის მქონე ნებისმიერი ხედავდა მონაცემებს.
 */
const PREFIX = "oa_";
const TTL_SEC = 60 * 60 * 24;

function sign(orderId: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me!!")
    .update("order-access:" + orderId)
    .digest("base64url");
}

export async function grantOrderAccess(orderId: string) {
  (await cookies()).set(PREFIX + orderId, sign(orderId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SEC,
  });
}

async function hasGrant(orderId: string): Promise<boolean> {
  const v = (await cookies()).get(PREFIX + orderId)?.value;
  if (!v) return false;
  const a = Buffer.from(v);
  const b = Buffer.from(sign(orderId));
  return a.length === b.length && timingSafeEqual(a, b);
}

export type OrderAccess = "owner" | "staff" | "grant" | "login" | "denied";

export async function orderAccess(order: { id: string; userId: string | null }): Promise<OrderAccess> {
  const viewer = await getCurrentUser();
  if (viewer && order.userId === viewer.id) return "owner";
  if (await getSession()) return "staff";
  if (await hasGrant(order.id)) return "grant";
  // შესული არ არის — შესვლის შემდეგ ისევ აქ დაბრუნდება
  return viewer ? "denied" : "login";
}
