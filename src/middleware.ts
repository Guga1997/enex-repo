import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";

const PUBLIC_ADMIN_PATHS = ["/admin/login"];

/** ორი დამოუკიდებელი სივრცე: /admin ადმინის სესიით, /account მყიდველის სესიით */
function cookieFor(pathname: string) {
  return pathname.startsWith("/account") ? "user_session" : "admin_session";
}
const NEEDS_AUTH = (p: string) => p.startsWith("/admin") || p.startsWith("/account");

/**
 * ენა მისამართშია: /en/catalog, /ru/catalog; ქართული პრეფიქსის გარეშე.
 * პრეფიქსს ვაშორებთ და იმავე გვერდზე ვაბრუნებთ (rewrite), ენას კი
 * `x-locale` სათაურით ვატანთ — ასე ერთი კომპლექტი გვერდები გვყოფნის.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const seg = pathname.split("/")[1] ?? "";
  let locale: Locale = DEFAULT_LOCALE;
  let path = pathname;

  if (isLocale(seg) && seg !== DEFAULT_LOCALE) {
    locale = seg;
    path = pathname.slice(seg.length + 1) || "/";
  }

  const headers = new Headers(req.headers);
  headers.set("x-locale", locale);

  if (NEEDS_AUTH(path) && !PUBLIC_ADMIN_PATHS.some((p) => path.startsWith(p))) {
    const token = req.cookies.get(cookieFor(path))?.value;
    if (!token) return redirectToLogin(req, path, locale);
    try {
      await jwtVerify(
        token,
        new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me!!")
      );
    } catch {
      return redirectToLogin(req, path, locale);
    }
  }

  if (path !== pathname) {
    const url = req.nextUrl.clone();
    url.pathname = path;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return NextResponse.next({ request: { headers } });
}

function redirectToLogin(req: NextRequest, path: string, locale: Locale) {
  const url = req.nextUrl.clone();
  const login = path.startsWith("/account") ? "/login" : "/admin/login";
  url.pathname = locale === DEFAULT_LOCALE ? login : `/${locale}${login}`;
  url.search = `?next=${encodeURIComponent(path)}`;
  return NextResponse.redirect(url);
}

/** სტატიკა, ატვირთული ფაილები და API გვერდის ლოგიკას არ სჭირდება */
export const config = {
  matcher: ["/((?!api|_next|uploads|brand|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)"],
};
