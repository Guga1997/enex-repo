import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_ADMIN_PATHS = ["/admin/login"];

/** ორი დამოუკიდებელი სივრცე: /admin ადმინის სესიით, /account მყიდველის სესიით */
function cookieFor(pathname: string) {
  return pathname.startsWith("/account") ? "user_session" : "admin_session";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(cookieFor(pathname))?.value;
  if (!token) return redirectToLogin(req);

  try {
    await jwtVerify(
      token,
      new TextEncoder().encode(
        process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me!!"
      )
    );
    return NextResponse.next();
  } catch {
    return redirectToLogin(req);
  }
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = req.nextUrl.pathname.startsWith("/account") ? "/login" : "/admin/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*", "/account/:path*"] };
