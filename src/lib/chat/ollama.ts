/**
 * Ollama — AI სერვერი ოფისშია, აქედან WireGuard გვირაბით ჩანს (10.66.0.2).
 * მისამართი და მოდელი .env-იდან იცვლება (OLLAMA_URL, OLLAMA_MODEL), ნაგულისხმევი — შეთანხმებული.
 */

export const OLLAMA_URL = (process.env.OLLAMA_URL || "http://10.66.0.2:11434").replace(/\/+$/, "");
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:26b";

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** ერთ პასუხზე (ყველა რაუნდი ერთად) ollama-ს ამდენი აქვს */
export const TIMEOUT_MS = num(process.env.OLLAMA_TIMEOUT_MS, 90_000);
/** ერთდროულად ამდენი მოთხოვნა; დანარჩენი რიგში დგას */
export const MAX_PARALLEL = num(process.env.OLLAMA_PARALLEL, 2);
/** რიგში ამაზე მეტი არ დგება — ახალს მაშინვე „მიუწვდომელია“ ეთქმება */
const MAX_QUEUE = 8;
/** რიგში ლოდინის ზღვარი */
const QUEUE_WAIT_MS = 60_000;

const OPTIONS = { temperature: 0.3, top_p: 0.8, top_k: 20 };

/* ───────────────────────────── რიგი ───────────────────────────── */

let running = 0;
const waiting: { grant: () => void }[] = [];

export const queueState = () => ({ running, waiting: waiting.length });

/**
 * ადგილი ollama-სთან. აბრუნებს გათავისუფლების ფუნქციას; null — რიგი სავსეა, ლოდინის დრო
 * ამოიწურა ან მომხმარებელი წავიდა. `onWait` ერთხელ იძახება, თუ დალოდება მოუწია.
 */
export async function acquire(signal: AbortSignal, onWait: () => void): Promise<(() => void) | null> {
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const next = waiting.shift();
    // ადგილი პირდაპირ შემდეგს გადაეცემა (running არ იცვლება); რიგი ცარიელია — თავისუფლდება
    if (next) next.grant();
    else running--;
  };
  if (signal.aborted) return null;
  if (running < MAX_PARALLEL) {
    running++;
    return release;
  }
  if (waiting.length >= MAX_QUEUE) return null;
  onWait();
  return new Promise((resolve) => {
    const entry = {
      grant: () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", giveUp);
        resolve(release);
      },
    };
    const giveUp = () => {
      const i = waiting.indexOf(entry);
      if (i < 0) return; // ადგილი უკვე მიღებულია
      waiting.splice(i, 1);
      clearTimeout(timer);
      signal.removeEventListener("abort", giveUp);
      resolve(null);
    };
    const timer = setTimeout(giveUp, QUEUE_WAIT_MS);
    signal.addEventListener("abort", giveUp);
    waiting.push(entry);
  });
}

/* ───────────────────────────── მისაწვდომობა ───────────────────────────── */

let health: { at: number; ok: boolean } | null = null;

/**
 * პასუხობს თუ არა ollama. გვირაბის გარეშე მოთხოვნა უბრალოდ იკარგება (პასუხი არ მოდის),
 * ამიტომ მოკლე ვადით ვამოწმებთ, რომ მომხმარებელმა 90 წამი არ ელოდოს. შედეგი ცოტა ხნით
 * ინახება: კარგი — 30 წამი, ცუდი — 10.
 */
export async function isUp(force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && health && now - health.at < (health.ok ? 30_000 : 10_000)) return health.ok;
  let ok = false;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/version`, { signal: AbortSignal.timeout(2500), cache: "no-store" });
    ok = res.ok;
    await res.body?.cancel();
  } catch {
    ok = false;
  }
  health = { at: Date.now(), ok };
  return ok;
}

/* ───────────────────────────── საუბარი ───────────────────────────── */

export type ToolCall = { function: { name: string; arguments: Record<string, unknown> } };
export type Msg =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_name: string };

const parseArgs = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw);
      if (v && typeof v === "object") return v as Record<string, unknown>;
    } catch {
      /* არასწორი JSON — ცარიელი არგუმენტებით */
    }
  }
  return {};
};

/**
 * ერთი რაუნდი: ტექსტი ნაწილ-ნაწილ მოდის `onText`-ში, ბოლოს ბრუნდება მთელი ტექსტი და
 * ხელსაწყოების გამოძახებები (თუ მოდელმა მოითხოვა). `tools` ცარიელია — მოდელი ვალდებულია
 * ტექსტით უპასუხოს.
 */
export async function chatRound(
  messages: Msg[],
  tools: readonly unknown[] | null,
  signal: AbortSignal,
  onText: (delta: string) => void,
): Promise<{ content: string; toolCalls: ToolCall[] }> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: true,
      think: false,
      options: OPTIONS,
      ...(tools?.length ? { tools } : {}),
    }),
    signal,
    cache: "no-store",
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ollama ${res.status}: ${detail.slice(0, 300)}`);
  }

  let content = "";
  const toolCalls: ToolCall[] = [];
  const take = (line: string) => {
    if (!line.trim()) return;
    const j = JSON.parse(line) as {
      error?: string;
      message?: { content?: string; tool_calls?: { function?: { name?: string; arguments?: unknown } }[] };
    };
    if (j.error) throw new Error(`ollama: ${j.error}`);
    const delta = j.message?.content ?? "";
    if (delta) {
      content += delta;
      onText(delta);
    }
    for (const c of j.message?.tool_calls ?? []) {
      const name = c.function?.name;
      if (name) toolCalls.push({ function: { name, arguments: parseArgs(c.function?.arguments) } });
    }
  };

  // პასუხი NDJSON-ია: თითო სტრიქონი — ერთი ნაწილი. სტრიქონი შეიძლება ორ პაკეტზე გაიყოს.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      take(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
  }
  take(buf + decoder.decode());
  return { content, toolCalls };
}
