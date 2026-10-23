/**
 * ინტელექტროს ადაპტერი — ნამდვილი პასუხების ნიმუშზე (tests/fixtures/intelectro-*.json).
 * ქსელს არ ვეხებით: fetch ჩანაცვლებულია, დეტალის შეცდომებიც ისეა, როგორც სერვერზე.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import path from "path";
import { categoryPathOf, intelectro, modelFromName, specsFromHtml } from "../src/lib/suppliers/intelectro";
import type { SupplierConfig } from "../src/lib/suppliers/types";

const fx = (f: string) => readFileSync(path.join(process.cwd(), "tests", "fixtures", f), "utf8");

const cfg: SupplierConfig = {
  slug: "intelectro",
  name: "Intelectro",
  baseUrl: "https://intelectro.test/api/v1",
  authType: "HEADER_KEY",
  secret: "test-key",
  authHeader: "api-key",
  fieldMap: null,
};

type Call = { url: string; method?: string; key?: string };

function stubFetch(calls: Call[]) {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url: u, method: init?.method, key: headers["api-key"] });
    if (u.endsWith("/products")) return new Response(fx("intelectro-products.json"), { status: 200 });
    if (u.endsWith("/product/882889")) return new Response(fx("intelectro-882889.json"), { status: 200 });
    // ასე პასუხობს ნამდვილი სერვერი ზოგ კოდზე
    if (u.endsWith("/product/882927")) {
      return new Response("<br />\n<b>Fatal error</b>:  Uncaught TypeError: mysqli_fetch_all()", { status: 200 });
    }
    return new Response(JSON.stringify({ status: "nothing found" }), { status: 200 });
  }) as typeof fetch;
}

test("მოდელი სახელიდან — უგრძესი ასოთი დაწყებული ციფრიანი სიტყვა", () => {
  assert.equal(modelFromName("IP კამერა, Uniarch 5MP Bullet, 4.0mm, SD, mic, IPC-B125-APF40"), "IPC-B125-APF40");
  assert.equal(modelFromName("ქსელური ჩამწერი 10 არხი, Uniarch, NVR-110S3"), "NVR-110S3");
  assert.equal(modelFromName("MP60UB ხმის გამაძლიერებელი 60W"), "MP60UB");
  assert.equal(modelFromName("DSP5311EN ზედაპირზე სამონტაჟო დინამიკი 3/6/12W, 6.5'', EN54-"), "DSP5311EN");
  assert.equal(modelFromName("მეხსიერების ბარათი Micro SD 64GB, TF-64G-T"), "TF-64G-T");
  assert.equal(modelFromName("EKB3 კლავიატურა LED"), "EKB3");
  // სტანდარტები და ზომები მოდელი არ არის
  assert.equal(modelFromName("როზეტი დამიწებით, ჩამკეტებით და ხუფით, IP44"), null);
  assert.equal(modelFromName("GSM ავტოდამრეკი VOXOUT"), null);
});

test("სპეციფიკაციის ცხრილი → მახასიათებლები", () => {
  const html = `<table><tbody>
    <tr><td><p>სენსორი&nbsp;</p></td><td>1/3", CMOS</td></tr>
    <tr><td><p>ხედვის კუთხე</p></td><td><p>(H) 89.1&deg;</p><p>(V) 47.3&deg;</p></td></tr>
    <tr><td colspan="2">სათაური</td></tr>
    <tr><td></td><td>ცარიელი სახელი</td></tr>
  </tbody></table>`;
  assert.deepEqual(specsFromHtml(html), [
    { name: "სენსორი", value: '1/3", CMOS' },
    { name: "ხედვის კუთხე", value: "(H) 89.1°; (V) 47.3°" },
  ]);
  assert.deepEqual(specsFromHtml(null), []);
});

test("კატეგორია: ჩვენი სახელი ბოლოში; სიგნალიზაცია ხუთ სეგმენტზე", () => {
  const acc = ["უსაფრთხოების სისტემები", "დაშვების კონტროლი", "წამკითხველები და კონტროლერები"];
  assert.deepEqual(categoryPathOf(acc, "K4 კოდირებული წამკითხველი"), [...acc, "დაშვების სისტემა"]);
  const alarm = ["უსაფრთხოების სისტემები", "დაცვითი სიგნალიზაცია"];
  assert.equal(categoryPathOf([...alarm, "დეტექტორები", "მოძრაობის"], "TITAN DL")?.at(-1), "დეტექტორები");
  assert.equal(categoryPathOf([...alarm, "კლავიატურები"], "EKB3 კლავიატურა LED")?.at(-1), "მართვის მოწყობილობები");
  assert.equal(categoryPathOf([...alarm, "გამაფართოვებელი მოდულები"], "EPGM1")?.at(-1), "საკონტროლო პანელები");
  assert.equal(categoryPathOf([...alarm, "აქსესუარები"], "Cbutton 8B საგანგაშო ღილაკი")?.at(-1), "მართვის მოწყობილობები");
  assert.equal(categoryPathOf(["ჭკვიანი სახლი", "ჩამრთველები"], "SwitchBox")?.at(-1), "ავტომატიზაცია");
  // წესი არ აქვს — მათი გზა უცვლელად, ჩვენი ძებნა სახელით
  const cam = ["უსაფრთხოების სისტემები", "სამეთვალყურეო სისტემები", "სათვალთვალო კამერები", "IP კამერები"];
  assert.deepEqual(categoryPathOf(cam, "IP კამერა"), cam);
  assert.equal(categoryPathOf([], "რამე"), undefined);
});

test("სია: ფასიანი პოზიციები, ნაშთი რეზერვის გამოკლებით, POST და api-key", async () => {
  const calls: Call[] = [];
  stubFetch(calls);
  const items = await intelectro.fetchItems(cfg);

  // ფასის გარეშე პოზიცია („ფასი მოთხოვნით“) არ შემოდის
  assert.deepEqual(items.map((i) => i.supplierSku).sort(), ["161000202", "882889", "882927", "SN 4"]);
  assert.ok(calls.every((c) => c.method === "POST" && c.key === "test-key"));

  const ekb = items.find((i) => i.supplierSku === "161000202")!;
  assert.equal(ekb.cost, 184);
  assert.equal(ekb.listPrice, null);
  assert.equal(ekb.qty, 30); // 36 − 6 რეზერვი
  assert.equal(ekb.brand, "Eldes");
});

test("დეტალი: კატეგორია, ფოტოები, ფაილი, მახასიათებლები; შეცდომა სინქს არ აჩერებს", async () => {
  const calls: Call[] = [];
  stubFetch(calls);
  const items = await intelectro.fetchItems(cfg);

  const cam = items.find((i) => i.supplierSku === "882889")!;
  assert.equal(cam.model, "IPC-B125-APF40");
  assert.deepEqual(cam.categoryPath, ["უსაფრთხოების სისტემები", "სამეთვალყურეო სისტემები", "სათვალთვალო კამერები", "IP კამერები"]);
  assert.ok(cam.images!.length >= 2 && cam.images!.every((u) => /^https:\/\/intelectro\.ge\/.+\.(jpg|png|webp)$/i.test(u)));
  assert.equal(cam.documents?.[0]?.url.endsWith("IPC-B125-APF40_Datasheet.pdf"), true);
  assert.ok(cam.attributes!.some((a) => a.name === "სენსორი"));
  assert.ok(cam.description?.startsWith("IP კამერა, Uniarch"));

  // PHP-ის შეცდომა — სიის მონაცემი რჩება, დეტალის გარეშე
  const amp = items.find((i) => i.supplierSku === "882927")!;
  assert.equal(amp.cost, 779);
  assert.equal(amp.images, undefined);

  // ჰარიანი კოდი დეტალზე არ იგზავნება — სერვერი მთავარ გვერდზე გადაამისამართებდა
  assert.ok(!calls.some((c) => c.url.includes("/product/SN")));
});

test("უკვე ცნობილ პოზიციაზე დეტალს აღარ ვითხოვთ", async () => {
  const calls: Call[] = [];
  stubFetch(calls);
  await intelectro.fetchItems(cfg, { known: new Set(["882889", "882927", "161000202"]) });
  assert.deepEqual(calls.map((c) => c.url), ["https://intelectro.test/api/v1/products"]);
});
