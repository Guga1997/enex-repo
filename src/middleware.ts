import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ADMIN_AUD, authSecret, isCustomerPayload } from "@/lib/auth-secret";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";
import { CORS_HEADERS, isApiV1 } from "@/lib/cors";
import { ROLES, canOpen, homeFor } from "@/lib/workflow";

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

  // API გარე სისტემებისთვისაა (კონფიგურატორის აპლიკაცია) — CORS ერთ ადგილას
  if (isApiV1(pathname)) {
    if (req.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
    return res;
  }

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
      const isAdmin = path.startsWith("/admin");
      const { payload } = await jwtVerify(token, authSecret(), isAdmin ? { audience: ADMIN_AUD } : {});
      if (!isAdmin && !isCustomerPayload(payload)) return redirectToLogin(req, path, locale);
      // განყოფილების თანამშრომელი ადმინის დანარჩენ გვერდებზე ვერ შედის —
      // მისამართის ხელით აკრეფაც აქვე ჩერდება, არა მარტო მენიუში დამალვით
      if (path.startsWith("/admin")) {
        // უცნობი ან არარსებული როლი — შესვლა არა (ადრე ადმინად ითვლებოდა)
        const role = String(payload.role ?? "");
        if (!(ROLES as readonly string[]).includes(role)) return redirectToLogin(req, path, locale);
        if (!canOpen(role, path)) {
          const url = sameOrigin(req);
          const home = homeFor(role);
          url.pathname = locale === DEFAULT_LOCALE ? home : `/${locale}${home}`;
          url.search = "";
          return NextResponse.redirect(url);
        }
      }
    } catch {
      return redirectToLogin(req, path, locale);
    }
  }

  if (path !== pathname) {
    const url = sameOrigin(req);
    url.pathname = path;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return NextResponse.next({ request: { headers } });
}

function redirectToLogin(req: NextRequest, path: string, locale: Locale) {
  const url = sameOrigin(req);
  const login = path.startsWith("/account") ? "/login" : "/admin/login";
  url.pathname = locale === DEFAULT_LOCALE ? login : `/${locale}${login}`;
  url.search = `?next=${encodeURIComponent(path)}`;
  return NextResponse.redirect(url);
}

/** სტატიკა, ატვირთული ფაილები და API გვერდის ლოგიკას არ სჭირდება */
export const config = {
  matcher: [
    "/api/v1/:path*",
    "/((?!api|_next|uploads|brand|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};

/**
 * გადამისამართების/rewrite-ის მისამართი req.url-იდან და არა req.nextUrl-იდან: NextURL
 * 127.0.0.1-ს localhost-ად აქცევს, Next-ის router-ი კი 127.0.0.1-ს ტოვებს (`next start -H
 * 127.0.0.1`). ჰოსტები არ ემთხვეოდა და Next ჩვენს rewrite-ს „გარე“ მისამართად თვლიდა:
 * /en → 500, /account → https://localhost:3000/login. req.url ჰოსტს უცვლელად ინარჩუნებს
 * next.config-ის `skipMiddlewareUrlNormalize`-ით.
 */
function sameOrigin(req: NextRequest) {
  return new URL(req.url);
}
