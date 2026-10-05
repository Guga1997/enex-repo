/**
 * MUK-ის XML ადაპტერი — ნამდვილ ნუსხაზე (tests/fixtures/muk.xml).
 * წვდომა IP-ითაა შეზღუდული, ამიტომ ქსელს არ ვეხებით: ნიმუში ფაილიდან იკითხება.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { muk } from "../src/lib/suppliers/muk";
import type { SupplierConfig } from "../src/lib/suppliers/types";

const FIXTURE = path.join(process.cwd(), "tests", "fixtures", "muk.xml");
const RATE = 2.7037;

const cfg: SupplierConfig = {
  slug: "muk",
  name: "MUK",
  baseUrl: "https://example.test/XML/PRICE",
  authType: "NONE",
  secret: null,
  authHeader: null,
  fieldMap: JSON.stringify({
    categories: { UPS: ["ენერგო უზრუნველყოფა", "უწყვეტი კვების წყაროები UPS"] },
    skipCategories: ["Medical"],
  }),
};

/** fetch-ს ვცვლით: PRICE — ნიმუში, CURRENCY — კურსი */
function stubFetch() {
  const xml = readFileSync(FIXTURE, "utf8");
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    if (u.endsWith("/CURRENCY")) {
      return new Response(
        `<?xml version="1.0" encoding="utf-8"?><CURRENCY><VALUE DATE="29.09.26">${RATE}</VALUE></CURRENCY>`,
        { status: 200 }
      );
    }
    return new Response(xml, { status: 200 });
  }) as typeof fetch;
}

test("MUK: ნუსხა იკითხება და ველები სწორად ჯდება", async (t) => {
  if (!existsSync(FIXTURE)) return t.skip("ნიმუში არ არის");
  stubFetch();

  const items = await muk.fetchItems(cfg);
  assert.ok(items.length > 100, `მხოლოდ ${items.length} პოზიცია`);

  for (const i of items.slice(0, 50)) {
    assert.ok(i.supplierSku, "კოდის გარეშე პოზიცია");
    assert.ok(i.name, `${i.supplierSku}: დასახელება ცარიელია`);
    assert.ok(i.qty >= 0, `${i.supplierSku}: უარყოფითი ნაშთი`);
    if (i.cost !== null && i.cost !== undefined) assert.ok(i.cost > 0, `${i.supplierSku}: ფასი ნულია`);
  }
});

test("MUK: ფასი დოლარიდან ლარში გადადის", async (t) => {
  if (!existsSync(FIXTURE)) return t.skip("ნიმუში არ არის");
  stubFetch();

  const items = await muk.fetchItems(cfg);
  const raw = readFileSync(FIXTURE, "utf8");
  const sample = items.find((i) => i.cost);
  assert.ok(sample);

  // იმავე პროდუქტის დოლარის ფასი ნედლი XML-იდან
  const block = raw.split("<Product ").find((b) => b.includes(`<VENDOR_PART_NUMBER>${sample.supplierSku}<`));
  assert.ok(block, "პროდუქტი ნედლ XML-ში ვერ ვიპოვე");
  const usd = Number(block.match(/<PRICE_DILER>([\d.]+)</)?.[1]);
  assert.ok(usd > 0);
  assert.equal(sample.cost, Math.round(usd * RATE * 100) / 100, `${sample.supplierSku}: კურსი არ ემთხვევა`);
});

test("MUK: სტატუსი ითარგმნება, მარაგი ინახება", async (t) => {
  if (!existsSync(FIXTURE)) return t.skip("ნიმუში არ არის");
  stubFetch();

  const items = await muk.fetchItems(cfg);
  const statuses = new Set(items.map((i) => i.status));
  for (const s of statuses) {
    assert.ok(
      ["IN_STOCK", "OUT_OF_STOCK", "IN_TRANSIT", "PREORDER"].includes(String(s)),
      `უცნობი სტატუსი: ${s}`
    );
  }
  assert.ok(items.some((i) => i.status === "IN_STOCK" && i.qty > 0), "მარაგში პოზიცია არ არის");
});

test("MUK: კატეგორიის რუკა და გამოტოვება მუშაობს", async (t) => {
  if (!existsSync(FIXTURE)) return t.skip("ნიმუში არ არის");
  stubFetch();

  const items = await muk.fetchItems(cfg);
  const ups = items.find((i) => i.categoryPath?.[1] === "უწყვეტი კვების წყაროები UPS");
  assert.ok(ups, "UPS-ის რუკა არ იმუშავა");
  assert.equal(ups.categoryPath?.[0], "ენერგო უზრუნველყოფა");
  assert.ok(!items.some((i) => i.categoryPath?.[0] === "Medical"), "გამოსატოვებელი კატეგორია დარჩა");
});

test("MUK: ფოტოები და მახასიათებლები მოდის", async (t) => {
  if (!existsSync(FIXTURE)) return t.skip("ნიმუში არ არის");
  stubFetch();

  const items = await muk.fetchItems(cfg);
  assert.ok(items.filter((i) => i.images?.length).length > 50, "ფოტოები თითქმის არ არის");
  assert.ok(items.filter((i) => i.attributes?.length).length > 50, "მახასიათებლები თითქმის არ არის");

  for (const i of items.filter((x) => x.images?.length).slice(0, 20)) {
    for (const u of i.images!) assert.match(u, /^https:\/\//, `${i.supplierSku}: არასწორი ფოტოს ბმული`);
  }
  for (const i of items.filter((x) => x.attributes?.length).slice(0, 20)) {
    for (const a of i.attributes!) {
      assert.ok(a.name && a.value, `${i.supplierSku}: ცარიელი მახასიათებელი`);
    }
  }
});

test("MUK: შეცდომის პასუხი გასაგებ შეტყობინებად იქცევა", async () => {
  globalThis.fetch = (async () =>
    new Response(
      `<?xml version="1.0"?><ERROR_LIST><ERROR_1>В доступе отказано. IP:1.2.3.4</ERROR_1></ERROR_LIST>`,
      { status: 200 }
    )) as typeof fetch;

  await assert.rejects(() => muk.fetchItems(cfg), /IP:1\.2\.3\.4/);
});

/* ------------- ნაშთის ორი ხაფანგი, რომელიც ნამდვილ ნუსხაში დაგვხვდა ------------ */

/** პატარა ნუსხა ხელით — ნამდვილი XML-ის ზუსტი შაბლონით */
function stubXml(products: string) {
  globalThis.fetch = (async (url: string | URL) => {
    if (String(url).endsWith("/CURRENCY")) {
      return new Response(`<CURRENCY><VALUE DATE="29.09.26">${RATE}</VALUE></CURRENCY>`, { status: 200 });
    }
    return new Response(`<?xml version="1.0" encoding="utf-8"?><PRICE>${products}</PRICE>`, { status: 200 });
  }) as typeof fetch;
}

const product = (sku: string, qty: string, status = "In Stock") => `
  <Product id="1">
    <VENDOR_PART_NUMBER>${sku}</VENDOR_PART_NUMBER>
    <NAME>APC Easy UPS On-Line SRV RM 3000VA</NAME>
    <PRICE_RETAIL>100.00</PRICE_RETAIL>
    <PRICE_DILER>80.00</PRICE_DILER>
    <CATEGORY>UPS</CATEGORY>
    <KOD2>On-line UPS</KOD2>
    <QUANTITY>${qty}</QUANTITY>
    <STATUS>${status}</STATUS>
  </Product>`;

test("MUK: „>20“ ნაშთი ოციაა და არა ნული", async () => {
  stubXml(product("SRV3KRIRK-E", "&gt;20"));
  const [item] = await muk.fetchItems(cfg);
  assert.equal(item.qty, 20, "„>20“ ნულად ჩაითვალა — პროდუქტი საიტზე გაქრებოდა");
  assert.equal(item.status, "IN_STOCK");
});

test("MUK: ერთი კოდის რამდენიმე ჩანაწერი ჯამდება", async () => {
  stubXml(product("SRV3KRIRK-E", "20") + product("SRV3KRIRK-E", "1") + product("SRV3KRIRK-E", "&gt;20"));
  const items = await muk.fetchItems(cfg);
  assert.equal(items.length, 1, "დუბლი ცალკე პოზიციად დარჩა");
  assert.equal(items[0].qty, 41, "ბოლო ჩანაწერმა წინა გადააფარა");
});

test("MUK: ნაშთიანი პარტია სჭარბობს ნულოვანს", async () => {
  stubXml(product("210-BPSQ", "0", "Reserve") + product("210-BPSQ", "2") + product("210-BPSQ", "0", "Reserve"));
  const [item] = await muk.fetchItems(cfg);
  assert.equal(item.qty, 2);
  assert.equal(item.status, "IN_STOCK", "ბოლო ნულოვანმა პარტიამ პროდუქტი გათიშა");
});

test("MUK: სტატუსების რიგი ჯამისას ინარჩუნებს უკეთესს", async () => {
  stubXml(product("AP9544", "0", "Available upon request") + product("AP9544", "0", "Coming Soon"));
  const [item] = await muk.fetchItems(cfg);
  assert.equal(item.qty, 0);
  assert.equal(item.status, "IN_TRANSIT", "მოსული პარტია მოთხოვნით შეკვეთას სჯობს");
});
