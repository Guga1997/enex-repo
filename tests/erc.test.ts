/**
 * ERC-ის პორტალი (erc-distribution.ge) — გვერდების გარჩევა და პოზიციების აწყობა.
 * ქსელის გარეშე: HTML-ის ნაჭრები პორტალის ნამდვილი განლაგებითაა.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { brandOf, fetchErcItems, parseDetail, parseListing, parsePriceBook, vendorSlugs, type ErcPrice } from "../src/lib/suppliers/erc";

const card = (id: number, slug: string, name: string, code: string, price: string, state: string) => `
<div class="product-item "> <div class="product-item__container"> <div class="product-item__image">
  <a href="/ware/${id}-${slug}/"> <img src="https://erc-distribution.ge/cache/media/erc2_200_150/upload/ware/1/x.jpg" alt="..."> </a> </div>
  <div class="product-item__content"> <div class="product-item__title"> <a href="/ware/${id}-${slug}/"> ${name} </a> </div>
  <div class="product-item__code">SKU: ${code}</div>
  <div class="product-item__price-wrap color-blue"> <div class="product-item__price-container">
    <div class="product-item__price-current"> <span>${price}</span> GEL* </div> </div>
    <div class="product-item__price-text ">${state}</div> </div> </div> </div> </div>`;

const MENU = `<a href="/en/vendor/asus/list.html">ASUS</a><a href="/en/vendor/2e/list.html">2E</a><a href="/en/vendor/2e-gaming/list.html">x</a><a href="/en/vendor/ardesto/list.html">x</a><a href="/en/vendor/dream-machines/list.html">x</a>`;
const PAGE1 =
  MENU +
  card(407920, "asus-prime-h810m-k", "ASUS PRIME H810M-K", "90MB1N10-M0EAY0", "305", "in stock") +
  card(401004, "ardesto-kholodilnik", "Refrigerator ARDESTO multi-door, 4doors, A++ &amp; NF", "DNF-M474X177", "1 799", "in stock") +
  `<a href="/cat/1527-materynski-platy/page-2/">2</a><a href="/cat/1527-materynski-platy/page-3/">3</a>`;
const PAGE2 = card(392537, "2e-gaming-case", "2E Gaming case", "2E-V500B", "69", "out of stock");
const PAGE3 = card(111, "dream-machines-mouse", "No price item", "DM-1", "", "in stock") + card(407920, "asus-prime-h810m-k", "dup", "90MB1N10-M0EAY0", "305", "in stock");

const DETAIL = `
<a href="/upload/uploaded_images/812/a_dnf-m474x177.jpg"><img src="https://erc-distribution.ge/cache/media/erc2_745_550/upload/uploaded_images/812/a_dnf-m474x177.jpg"></a>
<img data-src="/upload/uploaded_images/813/b_dnf.jpg"><img src="/upload/uploaded_images/1/p_enlabel_ardesto.jpg"><img src="/upload/vendors_logotypefile_svg/125/logo.svg">
<table><tr><td>Energy class</td><td>A++</td></tr><tr><td>Overall volume</td><td>474 l</td></tr></table>
<table><tr><td>Energy class</td><td>A++</td></tr><tr><td>Noise level</td><td>35 dB</td></tr>
<tr><td>წონა</td><td>96.50 კგ</td></tr><tr><td>მოცულობა</td><td>1.2 მ3</td></tr><tr><td>გარანტია</td><td>12 თვე</td></tr></table>`;

const cfg = (fieldMap: object = {}) => ({
  slug: "erc", name: "ERC", baseUrl: null, authType: "NONE", secret: null, authHeader: null,
  fieldMap: JSON.stringify({ sources: [{ path: "/cat/1527-materynski-platy", category: ["კომპიუტერის კომპონენტები", "დედადაფები"] }], ...fieldMap }),
});

test("სია: კოდი, სახელი, ფასი, ნაშთის ნიშანი და გვერდების რაოდენობა", () => {
  const { rows, pages } = parseListing(PAGE1);
  assert.equal(pages, 3);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    wareId: "407920", href: "/ware/407920-asus-prime-h810m-k/", slug: "asus-prime-h810m-k",
    name: "ASUS PRIME H810M-K", code: "90MB1N10-M0EAY0", price: 305, inStock: true,
  });
  assert.equal(rows[1].price, 1799, "ათასების ჰარი");
  assert.equal(rows[1].name, "Refrigerator ARDESTO multi-door, 4doors, A++ & NF");
  assert.equal(parseListing(PAGE2).rows[0].inStock, false);
  assert.equal(parseListing(PAGE3).rows[0].price, null, "ფასის გარეშე");
  assert.deepEqual(parseListing("<html></html>"), { rows: [], pages: 1 });
});

test("დეტალი: ორიგინალი ფოტოები (ეტიკეტი/ლოგო არა), მახასიათებლები გამეორების გარეშე, ლოგისტიკა ცალკე", () => {
  const d = parseDetail(DETAIL);
  assert.deepEqual(d.images, [
    "https://erc-distribution.ge/upload/uploaded_images/812/a_dnf-m474x177.jpg",
    "https://erc-distribution.ge/upload/uploaded_images/813/b_dnf.jpg",
  ]);
  assert.deepEqual(d.attributes, [
    { name: "Energy class", value: "A++" },
    { name: "Overall volume", value: "474 l" },
    { name: "Noise level", value: "35 dB" },
  ]);
  assert.equal(d.weightKg, 96.5);
  assert.equal(d.volumeM3, 1.2);
  assert.equal(d.warrantyMonths, 12);
});

test("ბრენდი მისამართიდან — ყველაზე გრძელი დამთხვევა", () => {
  const v = vendorSlugs(MENU);
  assert.equal(brandOf("asus-prime-h810m-k", v), "ASUS");
  assert.equal(brandOf("2e-gaming-case", v), "2E Gaming");
  assert.equal(brandOf("2e-v500b", v), "2E");
  assert.equal(brandOf("dream-machines-mouse", v), "Dream Machines");
  assert.equal(brandOf("ardesto-kholodilnik", v), "Ardesto");
  assert.equal(brandOf("unknown-thing", v), null);
});

test("ფასთა ფაილი: სვეტები სათაურით, აქციის ფასი უპირატესია, „10+“ → 10", () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ["", "", "ERC price list"],
    ["Category", "", "Model", "Specification", "გარანტია", "Quantity", "PRICE GEL", " PROMO PRICE GEL", "RRP GEL", "Promo RRP GEL"],
    ["მაცივარი", "", "DNF-M474X177", "…", "2წელი", "10+", 1390.2719, 1270, 1799, 1699],
    ["მაცივარი", "", "CR-21L", "…", "2წელი", "3", 189.166, "", 239, " "],
    ["", "", "", "", "", "", "", "", "", ""],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  const book = parsePriceBook(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);
  assert.deepEqual(book.get("DNF-M474X177"), { cost: 1270, rrp: 1699, qty: 10 });
  assert.deepEqual(book.get("CR-21L"), { cost: 189.17, rrp: 239, qty: 3 });
  assert.equal(book.size, 2);
});

test("სინქი: ყველა გვერდი, გამეორება ერთხელ, ფასი RRP-დან ან ფაილიდან, დეტალი მხოლოდ უცნობზე", async () => {
  const asked: string[] = [];
  const get = async (url: string) => {
    const u = new URL(url);
    asked.push(u.pathname);
    assert.equal(u.searchParams.get("_locale"), "en");
    if (u.pathname === "/cat/1527-materynski-platy/") return PAGE1;
    if (u.pathname.endsWith("/page-2/")) return PAGE2;
    if (u.pathname.endsWith("/page-3/")) return PAGE3;
    if (u.pathname.startsWith("/ware/401004-")) return DETAIL;
    if (u.pathname.startsWith("/ware/")) return "<html></html>";
    throw new Error("unexpected " + u.pathname);
  };
  const prices = new Map<string, ErcPrice>([["DNF-M474X177", { cost: 1270, rrp: 1699, qty: 7 }]]);
  const items = await fetchErcItems(cfg(), { known: new Set(["ERC-90MB1N10-M0EAY0"]) }, get, { pauseMs: 0, prices });

  assert.deepEqual(items.map((i) => i.supplierSku), ["ERC-90MB1N10-M0EAY0", "ERC-DNF-M474X177", "ERC-2E-V500B", "ERC-DM-1"]);
  const [board, fridge, pcCase, noPrice] = items;
  // პორტალის ერთადერთი ფასი RRP-ა: ისაა „გამოგზავნილი ფასი“ და საცალოც
  assert.equal(board.cost, 305);
  assert.equal(board.listPrice, 305);
  assert.equal(board.qty, 10);
  assert.equal(board.brand, "ASUS");
  assert.deepEqual(board.categoryPath, ["კომპიუტერის კომპონენტები", "დედადაფები"]);
  assert.equal(board.images, undefined, "ფოტო უკვე აქვს — დეტალს აღარ ვითხოვთ");
  // ფაილში ნაპოვნი: ჩვენი ფასი და რაოდენობა ფაილიდან, საცალო — პორტალიდან
  assert.equal(fridge.cost, 1270);
  assert.equal(fridge.listPrice, 1799);
  assert.equal(fridge.qty, 7);
  assert.equal(fridge.images?.length, 2);
  assert.equal(fridge.warrantyMonths, 12);
  assert.equal(pcCase.qty, 0);
  assert.equal(pcCase.status, "OUT_OF_STOCK");
  assert.equal(pcCase.brand, "2E Gaming");
  assert.equal(noPrice.cost, null);
  // მოძველებული ფაილი: ჩვენი ფასი პორტალის საცალოზე მეტია — არ ვიყენებთ
  const stale = await fetchErcItems(cfg(), {}, get, { pauseMs: 0, prices: new Map([["DNF-M474X177", { cost: 1900, rrp: 2100, qty: 4 }]]) });
  assert.equal(stale[1].cost, 1799);
  assert.equal(stale[1].listPrice, 1799);
  assert.ok(!asked.some((p) => p.startsWith("/ware/407920-")));

  // ლიმიტი: ერთ სინქზე არა უმეტეს detailsPerSync დეტალისა
  asked.length = 0;
  await fetchErcItems(cfg({ detailsPerSync: 1 }), {}, get, { pauseMs: 0, prices });
  assert.equal(asked.filter((p) => p.startsWith("/ware/")).length, 1);
});

test("ცარიელი პორტალი — შეცდომა (ნაშთები არ უნდა განულდეს)", async () => {
  await assert.rejects(() => fetchErcItems(cfg(), {}, async () => "<html></html>", { pauseMs: 0, prices: new Map() }), /ერთი პოზიციაც/);
});
