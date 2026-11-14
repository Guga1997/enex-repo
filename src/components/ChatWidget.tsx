"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLocale, usePath, useT } from "./LocaleProvider";
import WhatsAppIcon from "./WhatsAppIcon";

/**
 * AI კონსულტანტის ჩატი — ყველა საჯარო გვერდზე, ქვედა მარჯვენა კუთხეში.
 *
 * გვერდები სტატიკურია, ამიტომ ჩართულია თუ არა ჩატი, ბრაუზერი კითხულობს (/api/chat) —
 * ადმინში გათიშვა დეპლოის გარეშე მოქმედებს. საუბარი sessionStorage-შია: პროდუქტის ბმულზე
 * გადასვლის მერეც გრძელდება, ჩანართის დახურვისას ქრება. შეკითხვების ლიმიტს სერვერი ითვლის.
 */

type Msg = {
  role: "user" | "assistant";
  content: string;
  /** მოდელს უკან არ ეგზავნება: შეცდომა, „მიუწვდომელია“, საკონტაქტო ტექსტი */
  local?: boolean;
};

type Status = {
  enabled: boolean;
  limit: number;
  /** null — ლიმიტის გარეშე (ადმინი) */
  remaining: number | null;
  limitReached: boolean;
  contact: string;
  links: { tel: string; whatsapp: string; mailto: string };
  messageMax: number;
};

type ServerEvent =
  | { t: "delta"; text: string }
  | { t: "reset" }
  | { t: "status"; text: string }
  | { t: "done"; ok: boolean; remaining: number | null; limit: number; limitReached: boolean; append?: string };

const STORE = "enex-chat-v1";
const ENABLED_STORE = "enex-chat-on";
/** ჩართულია თუ არა — ამდენ ხანს არ ვეკითხებით სერვერს ყოველ გვერდზე */
const ENABLED_TTL_MS = 5 * 60_000;
const HISTORY_MAX = 10;
const HIDDEN_ON = ["/admin", "/stock"];

const FALLBACK_LINKS = { tel: "tel:+995511722622", whatsapp: "https://wa.me/995511722622", mailto: "mailto:sales@enex.ge" };

const QUICK = ["რა გაქვთ?", "მიწოდების პირობები", "მჭირდება UPS კომპიუტერისთვის", "გარანტია და დაბრუნება"];

const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

/* ───────────────────────────── Markdown ───────────────────────────── */

/** საიტის შიდა ბმული → გზა (იმავე ჩანართში იხსნება); გარე — null */
function internalPath(href: string): string | null {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const u = new URL(href);
    if (u.host === window.location.host || /^(www\.)?enex\.ge$/.test(u.host)) return u.pathname + u.search + u.hash;
  } catch {
    /* არასწორი მისამართი */
  }
  return null;
}

const INLINE =
  /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|mailto:[^\s)]+|tel:[^\s)]+)\)|\*\*([^\n]+?)\*\*|(https?:\/\/[^\s<>()]+)|`([^`\n]+)`|\*([^*\n]+)\*/g;

function Anchor({ href, onNavigate, children }: { href: string; onNavigate: (path: string) => void; children: ReactNode }) {
  const cls = "font-medium text-brand-600 underline underline-offset-2 break-words hover:text-brand-700";
  const path = /^(mailto:|tel:)/.test(href) ? null : internalPath(href);
  if (path) {
    return (
      <a
        href={path}
        className={cls}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          onNavigate(path);
        }}
      >
        {children}
      </a>
    );
  }
  const external = /^https?:/.test(href);
  return (
    <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

/** სტრიქონის შიგნით: ბმული, მუქი, დახრილი, კოდი, შიშველი მისამართი. HTML არასდროს ისმება. */
function inline(text: string, onNavigate: (path: string) => void, links = true, key = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const k = `${key}-${n++}`;
    if (m[1] !== undefined && m[2] !== undefined) {
      out.push(
        links ? (
          <Anchor key={k} href={m[2]} onNavigate={onNavigate}>
            {inline(m[1], onNavigate, false, k)}
          </Anchor>
        ) : (
          m[1]
        ),
      );
    } else if (m[3] !== undefined) {
      out.push(<strong key={k}>{inline(m[3], onNavigate, links, k)}</strong>);
    } else if (m[4] !== undefined) {
      // წინადადების ბოლო წერტილი ან მძიმე მისამართის ნაწილი არ არის
      const url = m[4].replace(/[.,;:!?…]+$/, "");
      const tail = m[4].slice(url.length);
      out.push(
        links ? (
          <Anchor key={k} href={url} onNavigate={onNavigate}>
            {url.replace(/^https?:\/\/(www\.)?/, "")}
          </Anchor>
        ) : (
          url
        ),
      );
      if (tail) out.push(tail);
    } else if (m[5] !== undefined) {
      out.push(
        <code key={k} className="rounded bg-surface px-1 py-0.5 text-[0.9em]">
          {m[5]}
        </code>,
      );
    } else if (m[6] !== undefined) {
      out.push(<em key={k}>{inline(m[6], onNavigate, links, k)}</em>);
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*(?:[-*•–]|\d{1,2}[.)])\s+(.*)$/;
const NUMBERED = /^\s*\d{1,2}[.)]\s+/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

/** აბზაცები, სიები, სათაურები (მუქი სტრიქონი). ცხრილი და სხვა — ჩვეულებრივი ტექსტი. */
function Markdown({ text, onNavigate }: { text: string; onNavigate: (path: string) => void }) {
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (!para.length) return;
    const k = `p${blocks.length}`;
    blocks.push(
      <p key={k} className="whitespace-pre-wrap break-words">
        {para.flatMap((line, i) => [...(i ? ["\n"] : []), ...inline(line, onNavigate, true, `${k}-${i}`)])}
      </p>,
    );
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const k = `l${blocks.length}`;
    const items = list.items.map((it, i) => (
      <li key={i} className="break-words">
        {inline(it, onNavigate, true, `${k}-${i}`)}
      </li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={k} className="list-decimal space-y-1 pl-5">
          {items}
        </ol>
      ) : (
        <ul key={k} className="list-disc space-y-1 pl-5">
          {items}
        </ul>
      ),
    );
    list = null;
  };

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const bullet = line.match(BULLET);
    const heading = line.match(HEADING);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push(
        <p key={`h${blocks.length}`} className="font-semibold">
          {inline(heading[1], onNavigate, true, `h${blocks.length}`)}
        </p>,
      );
    } else if (bullet) {
      flushPara();
      const ordered = NUMBERED.test(line);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push(bullet[1]);
    } else if (list && /^\s{2,}\S/.test(raw)) {
      // სიის პუნქტის გაგრძელება (შეწეული სტრიქონი)
      list.items[list.items.length - 1] += " " + line.trim();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <div className="space-y-2">{blocks}</div>;
}

/* ───────────────────────────── ფანჯარა ───────────────────────────── */

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.3A7.5 7.5 0 1 1 20 11.5z" />
      <path d="M9 11.5h.01M12.5 11.5h.01M16 11.5h.01" />
    </svg>
  );
}

export default function ChatWidget() {
  const t = useT();
  const locale = useLocale();
  const path = usePath();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat?lang=${locale}`, { cache: "no-store" });
      const s = (await res.json()) as Status;
      setEnabled(!!s.enabled);
      setStatus(s.enabled ? s : null);
      try {
        sessionStorage.setItem(ENABLED_STORE, JSON.stringify({ on: !!s.enabled, at: Date.now() }));
      } catch {
        /* ინკოგნიტოში წერა შეიძლება აკრძალული იყოს */
      }
    } catch {
      /* ქსელი არ არის — ღილაკი უბრალოდ არ გამოჩნდება ან ძველი მდგომარეობა რჩება */
    }
  }, [locale]);

  // საუბრის აღდგენა და „ჩართულია?“ — მხოლოდ ბრაუზერში, ჩატვირთვის შემდეგ
  useEffect(() => {
    let wasOpen = false;
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null") as { open?: boolean; messages?: Msg[] } | null;
      if (saved?.messages?.length) {
        // გვერდის გადატვირთვამ დაუსრულებელი პასუხი გაწყვიტა — ნახევარი პასუხი მოდელს უკან არ ეგზავნება
        const list = saved.messages.filter((m) => m.content.trim());
        setMessages(list);
      }
      wasOpen = !!saved?.open;
      setOpen(wasOpen);
    } catch {
      /* დაზიანებული ჩანაწერი — ახალი საუბარი */
    }
    let cached: { on: boolean; at: number } | null = null;
    try {
      cached = JSON.parse(sessionStorage.getItem(ENABLED_STORE) ?? "null");
    } catch {
      /* — */
    }
    if (cached && Date.now() - cached.at < ENABLED_TTL_MS && !wasOpen) setEnabled(cached.on);
    else void refresh();
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ open, messages: messages.slice(-40) }));
    } catch {
      /* — */
    }
  }, [ready, open, messages]);

  // გახსნისას: ახალი მრიცხველი; ტელეფონზე გვერდი ქვემოდან არ უნდა გადაადგილდეს
  useEffect(() => {
    if (!open) return;
    void refresh();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const lock = isMobile();
    const prev = document.documentElement.style.overflow;
    if (lock) document.documentElement.style.overflow = "hidden";
    else inputRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      if (lock) document.documentElement.style.overflow = prev;
    };
  }, [open, refresh]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages, busy, note]);

  const navigate = useCallback(
    (to: string) => {
      if (isMobile()) setOpen(false);
      router.push(to);
    },
    [router],
  );

  const limitReached = !!status?.limitReached;
  const links = status?.links ?? FALLBACK_LINKS;
  const max = status?.messageMax ?? 500;
  const failText = t("კავშირი ვერ მოხერხდა. სცადეთ თავიდან ან დაგვიკავშირდით: ☎️ 511 72 26 22 (ზარი / WhatsApp)");

  async function send(textRaw: string) {
    const text = textRaw.trim().slice(0, max);
    if (!text || busy || limitReached) return;
    const history = [...messages, { role: "user" as const, content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setBusy(true);
    setNote("");

    let answer = "";
    let local = false;
    const show = () => setMessages([...history, { role: "assistant", content: answer, local }]);
    const handle = (e: ServerEvent) => {
      if (e.t === "delta") {
        answer += e.text;
        setNote("");
        show();
      } else if (e.t === "reset") {
        answer = "";
        show();
      } else if (e.t === "status") {
        setNote(e.text);
      } else {
        if (e.append) answer += `\n\n${e.append}`;
        local = !e.ok;
        show();
        setStatus((s) => (s ? { ...s, remaining: e.remaining, limit: e.limit, limitReached: e.limitReached || e.remaining === 0 } : s));
      }
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang: locale,
          messages: history.filter((m) => !m.local).slice(-HISTORY_MAX).map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        answer = j?.error && j.error !== "forbidden" ? j.error : failText;
        local = true;
        show();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let finished = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let cut: number;
        while ((cut = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, cut);
          buf = buf.slice(cut + 2);
          for (const line of block.split("\n")) {
            if (!line.startsWith("data:")) continue;
            try {
              const e = JSON.parse(line.slice(5)) as ServerEvent;
              if (e.t === "done") finished = true;
              handle(e);
            } catch {
              /* გაფუჭებული ნაწილი — გამოვტოვოთ */
            }
          }
        }
      }
      if (!finished) {
        // კავშირი პასუხის დასრულებამდე გაწყდა
        answer = answer ? answer : failText;
        local = true;
        show();
      }
    } catch {
      answer = answer || failText;
      local = true;
      show();
    } finally {
      setBusy(false);
      setNote("");
    }
  }

  if (!ready || !enabled || HIDDEN_ON.some((p) => path === p || path.startsWith(p + "/"))) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("AI კონსულტანტთან ჩატი")}
        title={t("AI კონსულტანტი")}
        className="fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-black/20 transition hover:scale-105 hover:bg-brand-600 print:hidden"
      >
        <ChatIcon className="size-7" />
      </button>
    );
  }

  const waiting = busy && !messages[messages.length - 1]?.content;
  const started = messages.some((m) => m.role === "user");
  const bigButton = "btn flex items-center justify-center gap-2 py-3 text-sm";

  return (
    <section
      role="dialog"
      aria-label={t("AI კონსულტანტი")}
      className="fixed inset-0 z-50 flex flex-col bg-surface text-ink shadow-2xl shadow-black/30 sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(40rem,calc(100dvh-2.5rem))] sm:w-[25rem] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-line print:hidden"
    >
      <header className="flex items-center gap-2 bg-nav px-4 py-3 text-white">
        <ChatIcon className="size-6 shrink-0 text-brand-300" />
        <h2 className="min-w-0 truncate text-sm font-semibold">{t("AI კონსულტანტი")}</h2>
        <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-medium text-amber-300">
          {t("სატესტო რეჟიმი")}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t("დახურვა")}
          title={t("დახურვა")}
          className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="size-5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <p className="border-b border-line bg-canvas px-4 py-2 text-xs leading-snug text-muted">
        <span className="mr-1 text-warn">⚠</span>
        {t("ეს სატესტო AI კონსულტანტია და შეიძლება შეცდეს. ფასი და მარაგი გადაამოწმეთ პროდუქტის გვერდზე ან დაგვირეკეთ.")}
      </p>

      <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 text-sm" aria-live="polite">
        <Bubble role="assistant">
          {t("გამარჯობა! მე ვარ enex.ge-ის AI კონსულტანტი. დაგეხმარებით პროდუქტის შერჩევაში, ფასის, მარაგის, მიწოდების და გარანტიის საკითხებში. რით შემიძლია დაგეხმაროთ?")}
        </Bubble>
        {!started && !limitReached && (
          <div className="flex flex-wrap gap-2 pl-1">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => void send(t(q))}
                className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
              >
                {t(q)}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.content ? (
            <Bubble key={i} role={m.role}>
              {m.role === "assistant" ? <Markdown text={m.content} onNavigate={navigate} /> : m.content}
            </Bubble>
          ) : null,
        )}
        {waiting && (
          <Bubble role="assistant">
            <span className="flex items-center gap-2 text-muted">
              <span className="flex gap-1" aria-hidden="true">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
              {note || t("იწერს…")}
            </span>
          </Bubble>
        )}
        <div ref={endRef} />
      </div>

      <footer className="border-t border-line bg-surface px-3 pb-3 pt-2">
        {status && (
          <p className="mb-2 text-center text-[11px] text-muted">
            {status.remaining === null ? t("ადმინი — ლიმიტის გარეშე") : t("დარჩენილი კითხვები: {0}", status.remaining)}
          </p>
        )}
        {limitReached ? (
          <div className="grid gap-2">
            <a href={links.tel} className={`${bigButton} btn-primary`}>
              📞 {t("დარეკვა")}
            </a>
            <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={`${bigButton} btn-outline`}>
              <WhatsAppIcon className="size-5 text-[#25D366]" /> WhatsApp
            </a>
            <a href={links.mailto} className={`${bigButton} btn-outline`}>
              ✉️ {t("ელფოსტა")}
            </a>
          </div>
        ) : (
          <>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send(draft);
              }}
            >
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
                rows={2}
                maxLength={max}
                placeholder={t("დაწერეთ შეკითხვა…")}
                aria-label={t("დაწერეთ შეკითხვა…")}
                className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-line bg-canvas px-3 py-2 text-base outline-none transition placeholder:text-muted focus:border-brand-500 sm:text-sm"
              />
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                aria-label={t("გაგზავნა")}
                title={t("გაგზავნა")}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white transition hover:bg-brand-600 disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </form>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a href={links.tel} className="btn btn-outline flex items-center justify-center gap-1.5 px-2 py-2 text-xs">
                📞 {t("დარეკვა")}
              </a>
              <a
                href={links.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline flex items-center justify-center gap-1.5 px-2 py-2 text-xs"
              >
                <WhatsAppIcon className="size-4 text-[#25D366]" /> WhatsApp
              </a>
            </div>
          </>
        )}
      </footer>
    </section>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: ReactNode }) {
  return role === "user" ? (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand-500 px-3 py-2 text-white">
        {children}
      </div>
    </div>
  ) : (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-canvas px-3 py-2 leading-relaxed">{children}</div>
    </div>
  );
}
