import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getChatSettings } from "@/lib/chat/settings";
import { BAD_REQUEST, IN_PROGRESS, TOO_FAST, TOO_LONG, UNAVAILABLE } from "@/lib/chat/texts";
import {
  MESSAGE_MAX, SESSION_COOKIE, contactLinks, generate, ipHash, isSessionId, newSessionId, parseBody, usage,
  type ChatEvent,
} from "@/lib/chat/service";
import { isLocale } from "@/lib/i18n/config";

/**
 * AI კონსულტანტის ჩატი.
 *
 *   GET  /api/chat — ჩართულია თუ არა, რამდენი შეკითხვა დარჩა, საკონტაქტო ბმულები
 *   POST /api/chat — { messages: ბოლო ≤10, lang } → პასუხი სტრიმით (SSE)
 *
 * ლიმიტი სერვერზე მოწმდება: საუბარი httpOnly cookie-შია, დამატებით IP ითვლება 24 საათში.
 */
export const dynamic = "force-dynamic";

/** IP-ზე 20 შეტყობინება 10 წუთში */
const RATE = { limit: 20, windowMs: 10 * 60_000 };
const BODY_MAX = 64_000;
const COOKIE_DAYS = 30;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const ipOf = (req: Request) =>
  req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

function cookieOf(req: Request): string | null {
  const raw = req.headers.get("cookie") ?? "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([a-f0-9]{32})(?:;|$)`));
  return m ? m[1] : null;
}

/** ადმინი ლიმიტის გარეშე წერს — ხარისხის შესამოწმებლად; მისი საუბრებიც ინახება */
const isAdmin = async () => (await getSession().catch(() => null)) !== null;

export async function GET(req: Request) {
  const s = await getChatSettings();
  const langParam = new URL(req.url).searchParams.get("lang") ?? "";
  const lang = isLocale(langParam) ? langParam : "ka";
  if (!s.enabled) return json({ enabled: false });
  const [u, admin] = await Promise.all([usage(cookieOf(req), ipOf(req), s), isAdmin()]);
  return json({
    enabled: true,
    limit: s.limit,
    remaining: admin ? null : u.remaining,
    limitReached: admin ? false : u.limitReached,
    contact: s.contact[lang],
    links: contactLinks(),
    messageMax: MESSAGE_MAX,
  });
}

/**
 * ერთ საუბარში ერთდროულად ერთი პასუხი, ერთი IP-დან კი იმდენი, რამდენი შეკითხვაც დარჩა —
 * შეკითხვა პასუხის დასრულებისას ითვლება და ლიმიტს პარალელური მოთხოვნებით გადაუვლიდნენ.
 */
const answering = new Set<string>();
const inFlight = new Map<string, number>();

export async function POST(req: Request) {
  // მხოლოდ ჩვენი საიტიდან: სხვა საიტის გვერდი ამ მისამართს ბრაუზერიდან ვერ გამოიყენებს
  const origin = req.headers.get("origin");
  if (origin) {
    let host = "";
    try {
      host = new URL(origin).host;
    } catch {
      /* არასწორი Origin */
    }
    if (host !== req.headers.get("host")) return json({ error: "forbidden" }, 403);
  }

  const text = await req.text().catch(() => "");
  let raw: unknown = null;
  if (text.length <= BODY_MAX) {
    try {
      raw = JSON.parse(text);
    } catch {
      /* ქვემოთ „bad“ */
    }
  }
  const body = parseBody(raw);
  const lang = body.lang;
  if (!body.ok) {
    return json({ error: body.error === "long" ? TOO_LONG[lang].replace("{0}", String(MESSAGE_MAX)) : BAD_REQUEST[lang] }, 400);
  }

  const s = await getChatSettings();
  if (!s.enabled) return json({ error: UNAVAILABLE[lang] }, 503);

  const ip = ipOf(req);
  if (!rateLimit(`chat:${ip}`, RATE.limit, RATE.windowMs).ok) return json({ error: TOO_FAST[lang] }, 429);

  const existing = cookieOf(req);
  const sessionId = isSessionId(existing) ? existing : newSessionId();
  const admin = await isAdmin();
  const before = await usage(existing, ip, s);

  const headers = new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    // no-transform: Next-ის gzip სტრიმს ბუფერში არ აგროვებს; X-Accel-Buffering: nginx-იც
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  });
  if (!existing) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=${sessionId}; Path=/; Max-Age=${COOKIE_DAYS * 86400}; HttpOnly; SameSite=Lax${secure}`,
    );
  }

  const encoder = new TextEncoder();
  const frame = (e: ChatEvent) => encoder.encode(`data: ${JSON.stringify(e)}\n\n`);

  // ლიმიტი ამოწურულია: AI-ს გარეშე, იგივე საკონტაქტო ტექსტი
  if (!admin && before.remaining <= 0) {
    if (existing) {
      await db.chatSession.updateMany({ where: { id: existing, limitReached: false }, data: { limitReached: true } }).catch(() => {});
    }
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(frame({ t: "delta", text: s.contact[lang] }));
        c.enqueue(frame({ t: "done", ok: false, remaining: 0, limit: s.limit, limitReached: true }));
        c.close();
      },
    });
    return new Response(stream, { headers });
  }

  const flying = inFlight.get(ip) ?? 0;
  if (answering.has(sessionId) || (!admin && flying >= before.remaining)) return json({ error: IN_PROGRESS[lang] }, 429);
  answering.add(sessionId);
  inFlight.set(ip, flying + 1);

  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      let open = true;
      const send = (chunk: Uint8Array) => {
        if (!open) return;
        try {
          c.enqueue(chunk);
        } catch {
          open = false;
        }
      };
      const emit = (e: ChatEvent) => send(frame(e));
      // პირველი ბაიტები მაშინვე: nginx და ბრაუზერი კავშირს გახსნილად თვლის; მერე — „პინგი“,
      // რომ ხანგრძლივი ძებნისას კავშირი უმოქმედობით არ გაწყდეს
      send(encoder.encode(": ok\n\n"));
      const ping = setInterval(() => send(encoder.encode(": ping\n\n")), 15_000);
      const t0 = Date.now();

      try {
        await db.chatSession.upsert({
          where: { id: sessionId },
          create: { id: sessionId, ipHash: ipHash(ip), locale: lang },
          update: { locale: lang },
        });
        await db.chatMessage.create({ data: { sessionId, role: "user", content: body.question } });

        const out = await generate(body.history, lang, abort.signal, emit);
        const ok = out.status === "ok";
        if (!ok && out.status !== "aborted") {
          emit({ t: "reset" });
          emit({ t: "delta", text: UNAVAILABLE[lang] });
        }

        // შეკითხვა ითვლება მხოლოდ მაშინ, როცა AI-მ მართლა უპასუხა
        let after = before;
        if (ok) {
          await db.chatSession.update({ where: { id: sessionId }, data: { questions: { increment: 1 } } });
          after = { ...before, remaining: Math.max(0, before.remaining - 1), limitReached: before.remaining - 1 <= 0 };
        }
        const reached = !admin && ok && after.limitReached;
        const content = ok ? out.content + (reached ? `\n\n${s.contact[lang]}` : "") : out.status === "aborted" ? "" : UNAVAILABLE[lang];
        await db.chatMessage.create({
          data: {
            sessionId,
            role: "assistant",
            content,
            tools: out.tools.length ? JSON.stringify(out.tools) : null,
            ms: Date.now() - t0,
            status: out.status,
          },
        });
        if (reached) await db.chatSession.update({ where: { id: sessionId }, data: { limitReached: true } });

        emit({
          t: "done",
          ok,
          remaining: admin ? null : after.remaining,
          limit: s.limit,
          limitReached: reached,
          ...(reached ? { append: s.contact[lang] } : {}),
        });
      } catch (e) {
        console.error("[chat]", e);
        emit({ t: "reset" });
        emit({ t: "delta", text: UNAVAILABLE[lang] });
        emit({ t: "done", ok: false, remaining: admin ? null : before.remaining, limit: s.limit, limitReached: false });
      } finally {
        clearInterval(ping);
        answering.delete(sessionId);
        const left = (inFlight.get(ip) ?? 1) - 1;
        if (left > 0) inFlight.set(ip, left);
        else inFlight.delete(ip);
        if (open) {
          try {
            c.close();
          } catch {
            /* უკვე დახურულია */
          }
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, { headers });
}
