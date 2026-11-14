import { createHmac, randomBytes } from "crypto";
import { db } from "../db";
import { isLocale, type Locale } from "../i18n/config";
import { CONTACT, WHATSAPP_URL } from "../seo";
import type { ChatSettings } from "./settings";
import { SEARCHING, SYSTEM_PROMPT, WAIT } from "./texts";
import { TOOLS, runTool } from "./tools";
import { TIMEOUT_MS, acquire, chatRound, isUp, type Msg } from "./ollama";

/**
 * AI კონსულტანტის ჩატი: მოთხოვნის შემოწმება, შეკითხვების ლიმიტი და პასუხის გენერაცია
 * (ollama + ხელსაწყოების ციკლი). HTTP-ის ნაწილი — src/app/api/chat/route.ts.
 */

export const MESSAGE_MAX = 500;
export const HISTORY_MAX = 10;
/** ხელსაწყოების რაუნდები ერთ პასუხზე; ამის მერე მოდელი ვალდებულია ტექსტით უპასუხოს */
export const TOOL_ROUNDS_MAX = 4;
/** ერთ რაუნდში ამაზე მეტი გამოძახება არ სრულდება */
const CALLS_PER_ROUND = 4;
/** წინა პასუხები ისტორიაში ამაზე გრძელი არ გადაეცემა */
const ASSISTANT_MAX = 3000;

/* ───────────────────────────── მოთხოვნა ───────────────────────────── */

export type Turn = { role: "user" | "assistant"; content: string };
export type ParsedBody =
  | { ok: true; history: Turn[]; question: string; lang: Locale }
  | { ok: false; error: "bad" | "long"; lang: Locale };

/** ბოლო ≤10 შეტყობინება + საიტის ენა. ბოლო აუცილებლად მომხმარებლისაა და ≤500 სიმბოლოა. */
export function parseBody(raw: unknown): ParsedBody {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lang: Locale = typeof body.lang === "string" && isLocale(body.lang) ? body.lang : "ka";
  if (!Array.isArray(body.messages)) return { ok: false, error: "bad", lang };

  const turns: Turn[] = [];
  for (const m of body.messages.slice(-HISTORY_MAX)) {
    const role = (m as Turn | null)?.role;
    const content = (m as Turn | null)?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return { ok: false, error: "bad", lang };
    const text = content.trim();
    if (!text) continue;
    turns.push({ role, content: role === "user" ? text.slice(0, MESSAGE_MAX) : text.slice(0, ASSISTANT_MAX) });
  }
  const last = (body.messages as Turn[])[body.messages.length - 1];
  if (!last || last.role !== "user" || typeof last.content !== "string") return { ok: false, error: "bad", lang };
  const question = last.content.trim();
  if (!question) return { ok: false, error: "bad", lang };
  if (question.length > MESSAGE_MAX) return { ok: false, error: "long", lang };
  // ისტორია მომხმარებლის შეტყობინებით უნდა იწყებოდეს (10-ზე მოჭრისას პასუხი შეიძლება პირველი აღმოჩნდეს)
  while (turns.length && turns[0].role !== "user") turns.shift();
  return { ok: true, history: turns, question, lang };
}

/* ───────────────────────────── სესია და ლიმიტი ───────────────────────────── */

export const SESSION_COOKIE = "enex_chat";
export const newSessionId = () => randomBytes(16).toString("hex");
export const isSessionId = (v: string | undefined | null): v is string => !!v && /^[a-f0-9]{32}$/.test(v);

/**
 * IP მხოლოდ ჰეშად ინახება (დღიური ლიმიტისთვის): საიდუმლო გასაღებით, ამიტომ ბაზიდან
 * მისამართის აღდგენა ან გადარჩევით გამოცნობა შეუძლებელია.
 */
export function ipHash(ip: string): string {
  const secret = process.env.AUTH_SECRET || "enex-chat-dev";
  return createHmac("sha256", secret).update(`chat-ip:${ip}`).digest("hex").slice(0, 32);
}

const DAY_MS = 24 * 60 * 60_000;

export type Usage = { session: number; ip: number; remaining: number; limitReached: boolean };

/**
 * რამდენი შეკითხვა დარჩა. ორი მრიცხველია: საუბრის (cookie) და IP-ის ბოლო 24 საათში —
 * ახალი ჩანართი, ინკოგნიტო ან წაშლილი cookie ლიმიტს არ ანულებს. უცნობი IP (nginx-ის
 * გარეშე, პირდაპირი მოთხოვნა სერვერიდან) მხოლოდ საუბრით ითვლება.
 */
export async function usage(sessionId: string | null, ip: string, s: ChatSettings): Promise<Usage> {
  const [session, ipCount] = await Promise.all([
    sessionId ? db.chatSession.findUnique({ where: { id: sessionId }, select: { questions: true, limitReached: true } }) : null,
    ip === "unknown"
      ? 0
      : db.chatMessage.count({
          where: {
            role: "assistant",
            status: "ok",
            createdAt: { gte: new Date(Date.now() - DAY_MS) },
            session: { ipHash: ipHash(ip) },
          },
        }),
  ]);
  const used = session?.questions ?? 0;
  const remaining = Math.max(0, Math.min(s.limit - used, s.ipLimit - ipCount));
  return { session: used, ip: ipCount, remaining, limitReached: remaining <= 0 };
}

/** ჩატის ფანჯრის ღილაკები: დარეკვა, WhatsApp, ელფოსტა */
export function contactLinks() {
  const phone = (CONTACT.phone || "+995 511 72 26 22").replace(/[^0-9+]/g, "");
  return {
    tel: `tel:${phone}`,
    whatsapp: WHATSAPP_URL || "https://wa.me/995511722622",
    mailto: `mailto:${CONTACT.email}`,
  };
}

/* ───────────────────────────── პასუხის გენერაცია ───────────────────────────── */

export type ChatEvent =
  /** პასუხის ტექსტის მორიგი ნაწილი */
  | { t: "delta"; text: string }
  /** აქამდე ნაჩვენები ტექსტი გაუქმდა (მოდელმა ტექსტის მერე ხელსაწყო გამოიძახა, ან პასუხი ჩაიშალა) */
  | { t: "reset" }
  /** დროებითი წარწერა „იწერს…“-ის ადგილას: რიგი, ძებნა */
  | { t: "status"; text: string }
  | {
      t: "done";
      ok: boolean;
      /** null — ლიმიტის გარეშე (ადმინი) */
      remaining: number | null;
      limit: number;
      limitReached: boolean;
      /** პასუხს ბოლოში ემატება (საკონტაქტო ტექსტი ბოლო შეკითხვაზე) */
      append?: string;
    };

export type ToolLog = { name: string; args: Record<string, unknown>; result: Record<string, unknown>; ms: number };
export type Outcome = {
  status: "ok" | "unavailable" | "busy" | "timeout" | "aborted" | "error";
  content: string;
  tools: ToolLog[];
};

/** ტექსტი მოდის — ვადა ამდენით გრძელდება, რომ დაწყებული პასუხი შუაში არ გაწყდეს */
const IDLE_MS = 15_000;

export async function generate(
  history: Turn[],
  lang: Locale,
  signal: AbortSignal,
  emit: (e: ChatEvent) => void,
): Promise<Outcome> {
  const tools: ToolLog[] = [];
  const fail = (status: Outcome["status"]): Outcome => ({ status, content: "", tools });

  if (!(await isUp())) return fail("unavailable");
  const release = await acquire(signal, () => emit({ t: "status", text: WAIT[lang] }));
  if (!release) return fail(signal.aborted ? "aborted" : "busy");

  // ვადა ერთია მთელ პასუხზე (ყველა რაუნდი). სანამ ტექსტი მოდის, ცოტ-ცოტათი გრძელდება,
  // მაგრამ ორმაგ ვადას ვერ გასცდება.
  const ctl = new AbortController();
  const started = Date.now();
  let timedOut = false;
  let deadline = started + TIMEOUT_MS;
  let timer = setTimeout(expire, TIMEOUT_MS);
  function expire() {
    timedOut = true;
    ctl.abort();
  }
  const keepAlive = () => {
    const now = Date.now();
    const wanted = Math.min(now + IDLE_MS, started + TIMEOUT_MS * 2);
    if (wanted <= deadline) return;
    deadline = wanted;
    clearTimeout(timer);
    timer = setTimeout(expire, deadline - now);
  };
  const onAbort = () => ctl.abort();
  signal.addEventListener("abort", onAbort);

  let shown = false;
  try {
    const msgs: Msg[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];
    for (let round = 0; ; round++) {
      const withTools = round < TOOL_ROUNDS_MAX;
      shown = false;
      const r = await chatRound(msgs, withTools ? TOOLS : null, ctl.signal, (text) => {
        shown = true;
        keepAlive();
        emit({ t: "delta", text });
      });
      if (!withTools || !r.toolCalls.length) {
        const content = r.content.trim();
        return content ? { status: "ok", content, tools } : fail("error");
      }

      // ხელსაწყოს წინ ნათქვამი („ახლავე მოვძებნი“) პასუხი არ არის — ფანჯრიდან ქრება
      if (shown) emit({ t: "reset" });
      emit({ t: "status", text: SEARCHING[lang] });
      msgs.push({ role: "assistant", content: r.content, tool_calls: r.toolCalls });
      for (const call of r.toolCalls.slice(0, CALLS_PER_ROUND)) {
        const { name, arguments: args } = call.function;
        const t0 = Date.now();
        let out: Awaited<ReturnType<typeof runTool>>;
        try {
          out = await runTool(name, args, lang);
        } catch (e) {
          console.error("[chat] ხელსაწყო ჩავარდა:", name, e);
          out = { content: JSON.stringify({ error: "ხელსაწყო დროებით მიუწვდომელია" }), log: { error: "შეცდომა" } };
        }
        tools.push({ name, args, result: out.log, ms: Date.now() - t0 });
        msgs.push({ role: "tool", tool_name: name, content: out.content });
      }
    }
  } catch (e) {
    if (signal.aborted) return fail("aborted");
    if (timedOut) return fail("timeout");
    console.error("[chat] ollama:", e instanceof Error ? e.message : e);
    return fail("error");
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
    release();
  }
}
