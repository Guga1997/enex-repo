import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { CONTACT_MAX, LIMIT_MAX, getChatSettings } from "@/lib/chat/settings";
import { OLLAMA_MODEL, OLLAMA_URL, isUp, queueState } from "@/lib/chat/ollama";
import type { ToolLog } from "@/lib/chat/service";
import { saveChatSettingsAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI ჩატები" };

const PER_PAGE = 30;
const WHEN = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tbilisi", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", second: "2-digit" });

const STATUS_LABEL: Record<string, string> = {
  unavailable: "AI მიუწვდომელი იყო",
  busy: "რიგი სავსე იყო",
  timeout: "ვადა გავიდა",
  aborted: "მომხმარებელმა გაწყვიტა",
  error: "შეცდომა",
};

const sec = (ms: number | null) => (ms == null ? "" : `${(ms / 1000).toFixed(1)} წმ`);

function parseTools(raw: string | null): ToolLog[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as ToolLog[]) : [];
  } catch {
    return [];
  }
}

export default async function AiChatsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff("/admin/ai-chats");
  const sp = await searchParams;
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const onlyLimit = sp.only === "limit";
  const where = onlyLimit ? { limitReached: true } : {};
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000);

  const [settings, up, total, sessions, answered, failed, reached] = await Promise.all([
    getChatSettings(),
    isUp(true),
    db.chatSession.count({ where }),
    db.chatSession.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { messages: { orderBy: { createdAt: "asc" } } },
    }),
    db.chatMessage.count({ where: { role: "assistant", status: "ok", createdAt: { gte: dayAgo } } }),
    db.chatMessage.count({ where: { role: "assistant", status: { notIn: ["ok", "aborted"] }, createdAt: { gte: dayAgo } } }),
    db.chatSession.count({ where: { limitReached: true, updatedAt: { gte: dayAgo } } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const queue = queueState();
  const href = (p: number) => `/admin/ai-chats?${new URLSearchParams({ ...(onlyLimit ? { only: "limit" } : {}), page: String(p) })}`;
  const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">AI ჩატები</h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${up ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
          AI სერვერი: {up ? "კავშირი არის" : "კავშირი არ არის"}
        </span>
        <span className="text-xs text-muted">
          {OLLAMA_URL} · {OLLAMA_MODEL} · ახლა მუშაობს {queue.running}, რიგშია {queue.waiting}
        </span>
      </div>
      <p className="text-sm text-muted">
        საიტის AI კონსულტანტის საუბრები — ხარისხის შესამოწმებლად. საუბარი ანონიმურია: სახელი, ტელეფონი და IP
        მისამართი არ ინახება. ბოლო 24 საათში: {answered} პასუხი, {failed} ჩაშლილი, {reached} საუბარმა მიაღწია ლიმიტს.
      </p>

      {sp.ok && <div className="card border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">პარამეტრები შენახულია.</div>}

      <form action={saveChatSettingsAction} className="card space-y-4 p-5">
        <h2 className="font-semibold">პარამეტრები</h2>
        <div>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="size-5 shrink-0" />
            AI ჩატი: ჩართული
          </label>
          <p className="mt-1 text-xs text-muted">
            გათიშვისას ღილაკი საიტიდან ქრება დეპლოის გარეშე. უკვე გახსნილ გვერდებზე ღილაკი 5 წუთამდე შეიძლება დარჩეს — ამ დროს
            ფანჯარაში „კონსულტანტი ახლა მიუწვდომელია“ წერია.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">შეკითხვების ლიმიტი ერთ მომხმარებელზე</span>
            <input type="number" name="limit" min={1} max={LIMIT_MAX} defaultValue={settings.limit} className={input} />
            <span className="mt-1 block text-xs text-muted">ერთ საუბარში AI ამდენ შეკითხვას პასუხობს, მერე საკონტაქტო ტექსტს აჩვენებს.</span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">ერთი IP-დან 24 საათში</span>
            <input type="number" name="ipLimit" min={1} max={LIMIT_MAX} defaultValue={settings.ipLimit} className={input} />
            <span className="mt-1 block text-xs text-muted">
              ახალი ჩანართით ან cookie-ის წაშლით ლიმიტს რომ ვერ აუარონ. ერთ ოფისს ან მობილურ ქსელს ხშირად ერთი IP აქვს —
              თუ მყიდველები ჩივიან, ეს რიცხვი გაზარდე.
            </span>
          </label>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {(
            [
              ["contactKa", "საკონტაქტო ტექსტი — ქართულად", settings.contact.ka],
              ["contactEn", "ინგლისურად", settings.contact.en],
              ["contactRu", "რუსულად", settings.contact.ru],
            ] as const
          ).map(([name, label, value]) => (
            <label key={name} className="block text-sm">
              <span className="mb-1 block font-medium">{label}</span>
              <textarea name={name} rows={4} maxLength={CONTACT_MAX} defaultValue={value} className={input} />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">
          საკონტაქტო ტექსტი ბოლო ნებადართული პასუხის ბოლოს ემატება და ლიმიტის მერე ყოველ მოთხოვნაზე ბრუნდება. ცარიელი ველი —
          ნაგულისხმევი ტექსტი. ადმინის ანგარიშით შესულს ლიმიტი არ ეხება.
        </p>
        <button className="btn btn-primary px-5 py-2 text-sm">შენახვა</button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/admin/ai-chats" className={`rounded-lg px-3 py-1.5 ${onlyLimit ? "border border-line" : "bg-brand-500 text-white"}`}>
          ყველა საუბარი
        </Link>
        <Link href="/admin/ai-chats?only=limit" className={`rounded-lg px-3 py-1.5 ${onlyLimit ? "bg-brand-500 text-white" : "border border-line"}`}>
          ლიმიტს მიღწეული
        </Link>
        <span className="text-muted">სულ: {total}</span>
      </div>

      {sessions.length === 0 && <div className="card p-8 text-center text-sm text-muted">საუბრები ჯერ არ არის.</div>}

      <div className="space-y-3">
        {sessions.map((s) => {
          const first = s.messages.find((m) => m.role === "user")?.content ?? "";
          const bad = s.messages.filter((m) => m.role === "assistant" && m.status && m.status !== "ok").length;
          return (
            <details key={s.id} className="card overflow-hidden">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-4 text-sm">
                <span className="font-mono text-xs text-muted">{WHEN.format(s.updatedAt)}</span>
                <span className="rounded bg-canvas px-1.5 py-0.5 text-[11px] uppercase">{s.locale}</span>
                <span className="text-xs text-muted">შეკითხვა: {s.questions}</span>
                {s.limitReached && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">ლიმიტს მიაღწია</span>
                )}
                {bad > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">ჩაშლილი: {bad}</span>
                )}
                <span className="min-w-0 flex-1 basis-full truncate font-medium sm:basis-0">{first}</span>
              </summary>
              <div className="space-y-3 border-t border-line bg-canvas p-4 text-sm">
                {s.messages.map((m) => {
                  const tools = parseTools(m.tools);
                  const isUser = m.role === "user";
                  return (
                    <div key={m.id} className={isUser ? "pl-0 sm:pr-16" : "sm:pl-16"}>
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                        <span className="font-semibold">{isUser ? "მომხმარებელი" : "AI"}</span>
                        <span className="font-mono">{TIME.format(m.createdAt)}</span>
                        {!isUser && m.ms != null && <span>პასუხის დრო: {sec(m.ms)}</span>}
                        {!isUser && m.status && m.status !== "ok" && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800">{STATUS_LABEL[m.status] ?? m.status}</span>
                        )}
                      </div>
                      {tools.length > 0 && (
                        <ul className="mb-1 space-y-1">
                          {tools.map((t, i) => (
                            <li key={i} className="rounded-lg border border-line bg-surface px-2 py-1 font-mono text-[11px] text-muted">
                              <span className="font-semibold text-ink">{t.name}</span>({JSON.stringify(t.args)}) → {JSON.stringify(t.result)} · {sec(t.ms)}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div
                        className={`whitespace-pre-wrap break-words rounded-xl border border-line px-3 py-2 ${isUser ? "bg-brand-50" : "bg-surface"}`}
                      >
                        {m.content || <span className="text-muted">(ცარიელი)</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={href(page - 1)} className="rounded-lg border border-line px-3 py-1.5">
              ← ახალი
            </Link>
          )}
          <span className="text-muted">
            გვერდი {page} / {pages}
          </span>
          {page < pages && (
            <Link href={href(page + 1)} className="rounded-lg border border-line px-3 py-1.5">
              ძველი →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
