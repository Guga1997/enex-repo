/**
 * ollama-ს იმიტაცია ტესტებისთვის: /api/version და /api/chat (NDJSON სტრიმი).
 * რას უპასუხებს, მომხმარებლის ბოლო შეტყობინებაზეა დამოკიდებული:
 *   „…tool…“  — ჯერ search_products-ს იძახებს, შედეგის მერე ტექსტით პასუხობს
 *   „…loop…“  — სანამ ხელსაწყოები აქვს, სულ იძახებს; მათ გარეშე — „ბოლო პასუხი“
 *   „…say…“   — ხელსაწყოს წინ ტექსტსაც ამბობს (ფანჯარამ ის უნდა წაშალოს)
 *   სხვა      — პირდაპირ ტექსტი, სამ ნაწილად
 */
import { createServer, type Server } from "http";

export type MockCall = { tools: number; messages: { role: string; content: string; tool_name?: string }[]; body: Record<string, unknown> };

export async function startMock(port = 0): Promise<{ url: string; calls: MockCall[]; close: () => Promise<void>; server: Server }> {
  const calls: MockCall[] = [];
  const server = createServer((req, res) => {
    if (req.url === "/api/version") {
      res.writeHead(200, { "Content-Type": "application/json" }).end('{"version":"mock"}');
      return;
    }
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", async () => {
      const body = JSON.parse(raw || "{}");
      const messages: MockCall["messages"] = body.messages ?? [];
      const tools: unknown[] = body.tools ?? [];
      calls.push({ tools: tools.length, messages, body });
      const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      const lastIsTool = messages[messages.length - 1]?.role === "tool";
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      const line = (message: object, done = false) => res.write(JSON.stringify({ model: body.model, message, done }) + "\n");
      const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const call = (q: string) => ({
        role: "assistant", content: "", tool_calls: [{ function: { name: "search_products", arguments: { q } } }],
      });

      if (/loop/.test(lastUser) && tools.length) {
        line(call("ინვერტორი"));
      } else if (/loop/.test(lastUser)) {
        line({ role: "assistant", content: "ბოლო პასუხი" });
      } else if (/tool|say/.test(lastUser) && !lastIsTool) {
        if (/say/.test(lastUser)) line({ role: "assistant", content: "ახლავე მოვძებნი. " });
        line(call("ინვერტორი"));
      } else {
        for (const part of ["გამარჯობა! ", "ეს არის **სატესტო** პასუხი. ", "[კატალოგი](/catalog)"]) {
          line({ role: "assistant", content: part });
          await pause(40);
        }
      }
      line({ role: "assistant", content: "" }, true);
      res.end();
    });
  });
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const addr = server.address();
  const p = typeof addr === "object" && addr ? addr.port : port;
  return {
    url: `http://127.0.0.1:${p}`,
    calls,
    server,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

// პირდაპირ გაშვება ფანჯრის ხელით საცდელად: npx tsx tests/chat-mock.ts 11999
if (process.argv[1]?.replace(/\\/g, "/").endsWith("tests/chat-mock.ts")) {
  startMock(Number(process.argv[2]) || 11999).then((m) => console.log("mock ollama:", m.url));
}
