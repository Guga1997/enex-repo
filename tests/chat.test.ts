/**
 * AI კონსულტანტის ჩატი (/api/chat): მოთხოვნის შემოწმება, შეკითხვების ლიმიტი, ხელსაწყოები
 * და პასუხის გენერაცია ollama-ს იმიტაციაზე. რეალურ ბაზაზე (dev SQLite).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startMock } from "./chat-mock";

const SID = "c4a7".repeat(8); // ტესტის საუბარი
const IP = "203.0.113.77";
const SECRET = /cost|dealer|listPrice|supplier|supply|priceLocked|stockAdjust|reservedQty/i;

let mock: Awaited<ReturnType<typeof startMock>>;
let db: typeof import("../src/lib/db").db;
let service: typeof import("../src/lib/chat/service");
let tools: typeof import("../src/lib/chat/tools");
let settings: typeof import("../src/lib/chat/settings");
let ollama: typeof import("../src/lib/chat/ollama");

before(async () => {
  mock = await startMock();
  // მისამართი მოდულის ჩატვირთვისას იკითხება — ამიტომ ჯერ env, მერე import
  process.env.OLLAMA_URL = mock.url;
  ({ db } = await import("../src/lib/db"));
  service = await import("../src/lib/chat/service");
  tools = await import("../src/lib/chat/tools");
  settings = await import("../src/lib/chat/settings");
  ollama = await import("../src/lib/chat/ollama");
  await db.chatSession.deleteMany({ where: { id: SID } });
});

after(async () => {
  await db.chatSession.deleteMany({ where: { id: SID } });
  await db.$disconnect();
  await mock.close();
});

test("მოთხოვნა: ბოლო ≤10 შეტყობინება, ბოლო — მომხმარებლის, ≤500 სიმბოლო", () => {
  const { parseBody, MESSAGE_MAX, HISTORY_MAX } = service;
  const ok = parseBody({ lang: "ru", messages: [{ role: "user", content: "  привет  " }] });
  assert.ok(ok.ok);
  assert.equal(ok.lang, "ru");
  assert.equal(ok.question, "привет");
  assert.deepEqual(ok.history, [{ role: "user", content: "привет" }]);

  assert.equal(parseBody({ messages: [{ role: "user", content: "x" }], lang: "xx" }).lang, "ka");
  assert.equal(parseBody(null).ok, false);
  assert.equal(parseBody({ messages: [] }).ok, false);
  assert.equal(parseBody({ messages: [{ role: "assistant", content: "x" }] }).ok, false, "ბოლო უნდა იყოს მომხმარებლის");
  assert.equal(parseBody({ messages: [{ role: "system", content: "x" }, { role: "user", content: "y" }] }).ok, false, "system არ მიიღება");
  assert.equal(parseBody({ messages: [{ role: "user", content: "   " }] }).ok, false);

  const long = parseBody({ messages: [{ role: "user", content: "ა".repeat(MESSAGE_MAX + 1) }] });
  assert.ok(!long.ok && long.error === "long");
  assert.ok(parseBody({ messages: [{ role: "user", content: "ა".repeat(MESSAGE_MAX) }] }).ok);

  // 25 შეტყობინებიდან ბოლო 10 რჩება და ისტორია მომხმარებლით იწყება
  const many = Array.from({ length: 25 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
  const cut = parseBody({ messages: many });
  assert.ok(cut.ok);
  assert.ok(cut.history.length <= HISTORY_MAX);
  assert.equal(cut.history[0].role, "user");
  assert.equal(cut.history[cut.history.length - 1].content, "m24");
});

test("პარამეტრები: არასწორი მნიშვნელობა ნაგულისხმევით იცვლება", () => {
  const { sanitize, DEFAULTS, LIMIT_MAX } = settings;
  assert.deepEqual(sanitize(null), DEFAULTS);
  assert.equal(DEFAULTS.limit, 3);
  assert.equal(DEFAULTS.enabled, true);
  const s = sanitize({ enabled: false, limit: 0, ipLimit: 9999, contact: { ka: "  ჩემი ტექსტი  ", en: "" } });
  assert.equal(s.enabled, false);
  assert.equal(s.limit, DEFAULTS.limit);
  assert.equal(s.ipLimit, LIMIT_MAX);
  assert.equal(s.contact.ka, "ჩემი ტექსტი");
  assert.equal(s.contact.en, DEFAULTS.contact.en, "ცარიელი — ნაგულისხმევი");
  assert.ok(DEFAULTS.contact.ka.includes("511 72 26 22") && DEFAULTS.contact.ka.includes("sales@enex.ge"));
});

test("ძებნის სათადარიგო ვარიანტები: ერთეულები საიტისეულად, მერე ციფრების გარეშე", () => {
  const { siteUnits, withoutNumbers, fallbackQueries } = tools;
  assert.deepEqual(siteUnits("ინვერტორი 12V"), ["ინვერტორი 12 ვოლტი", "ინვერტორი 12ვოლტი"]);
  assert.equal(siteUnits("ინვერტორი 1000W 12v")[0], "ინვერტორი 1000 ვატი 12 ვოლტი");
  assert.equal(siteUnits("გენერატორი 5.5kW")[0], "გენერატორი 5.5 კვტ");
  assert.equal(siteUnits("კამერა 4MP")[0], "კამერა 4 მპ");
  assert.deepEqual(siteUnits("როუტერი wifi"), [], "ერთეული არ არის — ვარიანტიც არ არის");
  assert.equal(withoutNumbers("ინვერტორი 12V 1000 ვატი"), "ინვერტორი");
  assert.deepEqual(fallbackQueries("ინვერტორი 12V"), ["ინვერტორი 12 ვოლტი", "ინვერტორი 12ვოლტი", "ინვერტორი"]);
  assert.deepEqual(fallbackQueries("ინვერტორი"), [], "იგივე მოთხოვნა ხელახლა არ იგზავნება");
});

test("search_products: შეკუმშული ჩანაწერი, მხოლოდ საჯარო ველები", async () => {
  const p = await db.product.findFirst({
    where: { isActive: true, price: { gt: 0 }, category: { isActive: true } },
    select: { sku: true },
  });
  assert.ok(p, "ბაზაში ხილული პროდუქტი არ არის");
  const out = await tools.runTool("search_products", { q: p.sku, limit: 3 }, "ka");
  const body = JSON.parse(out.content);
  assert.equal(body.items[0].sku, p.sku);
  assert.ok(body.items.length <= 3);
  const allowed = [
    "sku", "name", "brand", "model", "category", "price", "oldPrice", "discountPercent", "warrantyMonths",
    "stock", "url", "shortDescription", "attributes",
  ];
  for (const it of body.items) {
    for (const k of Object.keys(it)) assert.ok(allowed.includes(k), `მოულოდნელი ველი: ${k}`);
    assert.equal(typeof it.stock, "string", "მარაგი — მხოლოდ წარწერა");
    assert.ok((it.shortDescription ?? "").length <= 161);
    const attrs = Object.entries(it.attributes ?? {}) as [string, string][];
    assert.ok(attrs.length <= 6);
    for (const [name, value] of attrs) {
      assert.ok(value.length <= 60);
      assert.doesNotMatch(name, /^(Vendor|Condition of the product|Section subcategories)$/i);
    }
  }
  assert.doesNotMatch(Object.keys(body.items[0]).join(","), SECRET);
  assert.deepEqual((out.log as { skus: string[] }).skus.slice(0, 1), [p.sku]);

  const none = JSON.parse((await tools.runTool("search_products", { q: "zzqxjv48151623" }, "ka")).content);
  assert.equal(none.found, 0);
  assert.deepEqual(none.items, []);
  // უცნობი კატეგორია ძებნას არ აჩერებს
  const badCat = JSON.parse((await tools.runTool("search_products", { q: p.sku, category: "no-such-48151623" }, "ka")).content);
  assert.equal(badCat.items[0].sku, p.sku);
  assert.ok(badCat.note);
});

test("get_product, list_categories (2 დონე), store_info, უცნობი ხელსაწყო", async () => {
  const p = await db.product.findFirst({
    where: { isActive: true, price: { gt: 0 }, category: { isActive: true } },
    select: { sku: true, price: true },
  });
  const one = JSON.parse((await tools.runTool("get_product", { id_or_sku: p!.sku }, "ka")).content);
  assert.equal(one.sku, p!.sku);
  assert.equal(one.price, `${p!.price.toFixed(2)}₾`, "ფასი საიტისეული ჩაწერით");
  assert.ok(JSON.parse((await tools.runTool("get_product", { id_or_sku: "no-such-48151623" }, "ka")).content).error);

  const cats = (await tools.runTool("list_categories", {}, "ka")).content.split("\n");
  assert.ok(cats.length > 0);
  for (const line of cats) assert.match(line, /^(  - )?.+ \[[a-z0-9-]+\] — \d+$/, line);
  assert.ok(cats.some((l) => !l.startsWith("  ")), "პირველი დონე");

  const info = (await tools.runTool("store_info", {}, "ka")).content;
  assert.ok(info.includes("## მიწოდება") && info.includes("## გარანტია"));
  assert.ok(JSON.parse((await tools.runTool("delete_everything", {}, "ka")).content).error);
});

test("ლიმიტი: საუბრით და IP-ით 24 საათში; ჩაშლილი პასუხი არ ითვლება", async () => {
  const { usage, ipHash } = service;
  const s = { ...settings.DEFAULTS, limit: 3, ipLimit: 3 };
  assert.equal(ipHash(IP).length, 32);
  assert.notEqual(ipHash(IP), ipHash("203.0.113.78"));
  assert.doesNotMatch(ipHash(IP), /203/);

  assert.equal((await usage(null, IP, s)).remaining, 3);
  await db.chatSession.create({ data: { id: SID, ipHash: ipHash(IP), questions: 2 } });
  await db.chatMessage.createMany({
    data: [
      { sessionId: SID, role: "user", content: "1" },
      { sessionId: SID, role: "assistant", content: "a", status: "ok" },
      { sessionId: SID, role: "assistant", content: "b", status: "ok" },
      { sessionId: SID, role: "assistant", content: "x", status: "unavailable" },
    ],
  });
  const mine = await usage(SID, IP, s);
  assert.equal(mine.remaining, 1);
  assert.equal(mine.limitReached, false);
  // cookie წაშლილია (ახალი ჩანართი / ინკოგნიტო) — იგივე IP მაინც ითვლება
  assert.equal((await usage(null, IP, s)).remaining, 1);
  // სხვა IP იმავე cookie-ით — საუბრის მრიცხველი მოქმედებს
  assert.equal((await usage(SID, "203.0.113.200", s)).remaining, 1);
  // 24 საათზე ძველი პასუხი IP-ზე აღარ ითვლება
  await db.chatMessage.updateMany({ where: { sessionId: SID }, data: { createdAt: new Date(Date.now() - 25 * 3600_000) } });
  assert.equal((await usage(null, IP, s)).remaining, 3);
  assert.equal((await usage(SID, IP, s)).remaining, 1, "საუბრის მრიცხველი დროით არ ნულდება");

  await db.chatSession.update({ where: { id: SID }, data: { questions: 3 } });
  const done = await usage(SID, IP, s);
  assert.equal(done.remaining, 0);
  assert.equal(done.limitReached, true);
});

test("პასუხი: ტექსტი ნაწილ-ნაწილ, ollama-ს სწორი პარამეტრები", async () => {
  mock.calls.length = 0;
  const events: import("../src/lib/chat/service").ChatEvent[] = [];
  const out = await service.generate([{ role: "user", content: "გამარჯობა" }], "ka", new AbortController().signal, (e) => events.push(e));
  assert.equal(out.status, "ok");
  assert.equal(out.content, "გამარჯობა! ეს არის **სატესტო** პასუხი. [კატალოგი](/catalog)");
  assert.equal(events.filter((e) => e.t === "delta").length, 3);
  assert.deepEqual(out.tools, []);

  const sent = mock.calls[0].body as Record<string, unknown>;
  assert.equal(sent.model, ollama.OLLAMA_MODEL);
  assert.equal(sent.stream, true);
  assert.equal(sent.think, false);
  assert.deepEqual(sent.options, { temperature: 0.3, top_p: 0.8, top_k: 20 });
  assert.equal((sent.tools as unknown[]).length, 4);
  assert.equal(mock.calls[0].messages[0].role, "system");
  assert.ok(mock.calls[0].messages[0].content.startsWith("შენ ხარ enex.ge-ის ონლაინ კონსულტანტი."));
  assert.ok(mock.calls[0].messages[0].content.endsWith("მომხმარებლის ენის მიხედვით."));
});

test("ხელსაწყოს გამოძახება: შედეგი მოდელს უბრუნდება, ჩანაწერში რჩება", async () => {
  mock.calls.length = 0;
  const events: import("../src/lib/chat/service").ChatEvent[] = [];
  const out = await service.generate([{ role: "user", content: "say რა ინვერტორი გაქვთ" }], "ka", new AbortController().signal, (e) => events.push(e));
  assert.equal(out.status, "ok");
  assert.equal(mock.calls.length, 2);
  const toolMsg = mock.calls[1].messages.find((m) => m.role === "tool");
  assert.ok(toolMsg);
  assert.equal(toolMsg.tool_name, "search_products");
  assert.equal(JSON.parse(toolMsg.content).query, "ინვერტორი");
  assert.doesNotMatch(toolMsg.content, SECRET);
  assert.equal(out.tools.length, 1);
  assert.equal(out.tools[0].name, "search_products");
  assert.deepEqual(out.tools[0].args, { q: "ინვერტორი" });
  // ხელსაწყოს წინ ნათქვამი ტექსტი ფანჯრიდან იშლება, მერე „ვეძებ…“ ჩანს
  const kinds = events.map((e) => e.t);
  assert.ok(kinds.indexOf("reset") > kinds.indexOf("delta"));
  assert.ok(kinds.includes("status"));
  assert.ok(!out.content.includes("ახლავე მოვძებნი"));
});

test("ხელსაწყოების ციკლი: მაქსიმუმ 4 რაუნდი, მერე პასუხი ხელსაწყოების გარეშე", async () => {
  mock.calls.length = 0;
  const out = await service.generate([{ role: "user", content: "loop" }], "ka", new AbortController().signal, () => {});
  assert.equal(out.status, "ok");
  assert.equal(out.content, "ბოლო პასუხი");
  assert.equal(out.tools.length, service.TOOL_ROUNDS_MAX);
  assert.equal(mock.calls.length, service.TOOL_ROUNDS_MAX + 1);
  assert.deepEqual(mock.calls.map((c) => c.tools), [4, 4, 4, 4, 0]);
});

test("რიგი: ერთდროულად მაქსიმუმ 2, მესამე ელოდება", async () => {
  const { acquire, queueState, MAX_PARALLEL } = ollama;
  assert.equal(MAX_PARALLEL, 2);
  const sig = new AbortController().signal;
  const a = await acquire(sig, () => assert.fail("პირველი არ უნდა ელოდოს"));
  const b = await acquire(sig, () => assert.fail("მეორე არ უნდა ელოდოს"));
  assert.ok(a && b);
  let waited = false;
  const third = acquire(sig, () => (waited = true));
  assert.equal(waited, true);
  assert.deepEqual(queueState(), { running: 2, waiting: 1 });
  a();
  const c = await third;
  assert.ok(c);
  assert.deepEqual(queueState(), { running: 2, waiting: 0 });
  // წასული მომხმარებელი რიგიდან ამოდის
  const gone = new AbortController();
  const fourth = acquire(gone.signal, () => {});
  gone.abort();
  assert.equal(await fourth, null);
  b();
  c();
  a(); // ორჯერ გათავისუფლება არაფერს აფუჭებს
  assert.deepEqual(queueState(), { running: 0, waiting: 0 });
});

test("AI მიუწვდომელია — მაშინვე „unavailable“, ლოდინის გარეშე", async () => {
  await mock.close();
  await ollama.isUp(true);
  const t0 = Date.now();
  const out = await service.generate([{ role: "user", content: "გამარჯობა" }], "ka", new AbortController().signal, () => {});
  assert.equal(out.status, "unavailable");
  assert.ok(Date.now() - t0 < 3000);
  mock = await startMock();
});
