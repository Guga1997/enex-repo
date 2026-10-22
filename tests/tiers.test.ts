/**
 * პარტნიორების საფეხურები: ფასდაკლება მოგებაზე ითვლება და მოგების 60%
 * ყოველთვის ჩვენთან რჩება.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PARTNER_SHARE,
  TIERS,
  effectivePrice,
  isPartner,
  ourMargin,
  tierShare,
} from "../src/lib/pricing";
import { computePrices, realCost } from "../src/lib/suppliers/pricing";

/** საცალო 100, თვითღირებულება 60 → მოგება 40 */
const P = { price: 100, cost: 60 };
const buyer = (priceTier: string, discountPercent = 0) => ({ priceTier, discountPercent });

test("საფეხურები ათ-ათი პუნქტით იზრდება და 40%-ზე ჩერდება", () => {
  assert.deepEqual(
    TIERS.map((t) => t.share),
    [0, 0.1, 0.2, 0.3, 0.4]
  );
  assert.equal(MAX_PARTNER_SHARE, 0.4, "მოგების 60% ყოველთვის ჩვენსკენ");
  for (const t of TIERS) assert.ok(t.share <= MAX_PARTNER_SHARE, t.code);
});

test("ფასი მოგების წილით ითვლება, არა საცალოზე პროცენტით", () => {
  assert.equal(effectivePrice(P, buyer("RETAIL")).value, 100);
  assert.equal(effectivePrice(P, buyer("DEALER")).value, 96, "40-ის 10% = 4");
  assert.equal(effectivePrice(P, buyer("SILVER")).value, 92);
  assert.equal(effectivePrice(P, buyer("GOLD")).value, 88);
  assert.equal(effectivePrice(P, buyer("PLATINUM")).value, 84);
});

test("მოგების 60% ყოველთვის ჩვენთან რჩება", () => {
  const margin = P.price - P.cost;
  for (const t of TIERS) {
    const left = ourMargin(P, buyer(t.code))!;
    assert.ok(left >= margin * 0.6 - 0.001, `${t.code}: დაგვრჩა ${left}, მინიმუმი ${margin * 0.6}`);
  }
  assert.equal(ourMargin(P, buyer("PLATINUM")), 24, "ზედა საფეხურზე ზუსტად 60%");
});

test("ინდივიდუალური ფასდაკლებაც 60%-ის ზღვარს ემორჩილება", () => {
  // 50% საცალოზე ნიშნავდა 50₾-ს — თვითღირებულებაზე დაბლა
  const r = effectivePrice(P, buyer("DEALER", 50));
  assert.equal(r.value, 84, "ზღვარს ქვემოთ არ ჩამოვიდა");
  assert.ok(ourMargin(P, buyer("DEALER", 50))! >= 24);
});

test("მცირე ფასდაკლება საფეხურს სჯობს, თუ მომხმარებელს ურჩევნია", () => {
  // 8% საცალოზე = 92₾; დილერის საფეხური 96₾ — უკეთესს ვირჩევთ
  assert.equal(effectivePrice(P, buyer("DEALER", 8)).value, 92);
});

test("ზარალიან პროდუქტზე ფასდაკლება არ ედება", () => {
  const loss = { price: 50, cost: 80 };
  for (const t of TIERS) assert.equal(effectivePrice(loss, buyer(t.code)).value, 50, t.code);
});

test("თვითღირებულების გარეშე ძველი წესები მოქმედებს", () => {
  const noCost = { price: 100, dealerPrice: 85 };
  assert.equal(effectivePrice(noCost, buyer("DEALER")).value, 85, "ხელით დაწერილი სადილერო ფასი");
  assert.equal(effectivePrice({ price: 100 }, buyer("GOLD")).value, 100, "ვერაფრით ვითვლით — საცალო");
  assert.equal(effectivePrice({ price: 100 }, buyer("GOLD", 10)).value, 90, "ინდივიდუალური მუშაობს");
});

test("უცნობი საფეხური საცალოა — შემთხვევით ფასდაკლებას არ გასცემს", () => {
  assert.equal(tierShare("DIAMOND"), 0);
  assert.equal(isPartner("DIAMOND"), false);
  assert.equal(effectivePrice(P, buyer("DIAMOND")).value, 100);
});

test("დაზოგილი და პროცენტი სწორად ჩანს", () => {
  const r = effectivePrice(P, buyer("PLATINUM"));
  assert.equal(r.saved, 16);
  assert.equal(r.savedPercent, 16);
  assert.equal(r.retail, 100);
  assert.equal(r.isDealer, true);
  assert.equal(r.tier, "PLATINUM");
});

test("დაბალმარჟიანზე ფასდაკლებაც მცირეა — სწორედ ეს არის აზრი", () => {
  const thin = { price: 100, cost: 95 }; // მოგება 5
  assert.equal(effectivePrice(thin, buyer("PLATINUM")).value, 98, "40%-იც კი მხოლოდ 2₾-ია");
  assert.ok(ourMargin(thin, buyer("PLATINUM"))! >= 3);
});

/* ------- მიმწოდებლის ფასში ჩადებული ფასდაკლება (რომსატი: მინიმუმ 10%) ------- */

test("ერთფასიანი მიმწოდებლის ფასდაკლება მოგებად ჩანს, საცალოს კი არ ცვლის", () => {
  const rule = { retailBase: "COST", markupRetail: 15, markupDealer: 5 };

  const without = computePrices(rule, 100, null, { supplierDiscount: 0, minMargin: 0 });
  const with10 = computePrices(rule, 100, null, { supplierDiscount: 10, minMargin: 0 });

  assert.equal(without.price, with10.price, "საცალო იმავე ადგილას რჩება");
  assert.equal(with10.price, 115);
  assert.equal(without.cost, 100);
  assert.equal(with10.cost, 90, "ნამდვილი თვითღირებულება 10%-ით დაბლაა");

  // მოგება 15₾-დან 25₾-მდე იზრდება — სწორედ ამაზე ითვლება პარტნიორის ფასი
  const buyer = { priceTier: "PLATINUM", discountPercent: 0 };
  assert.equal(effectivePrice({ price: 115, cost: without.cost }, buyer).value, 109);
  assert.equal(effectivePrice({ price: 115, cost: with10.cost }, buyer).value, 105);
});

test("ფასდაკლება 0–90%-ის ფარგლებშია", () => {
  assert.equal(realCost(100, 0), 100);
  assert.equal(realCost(100, 10), 90);
  assert.equal(realCost(100, -5), 100, "უარყოფითი ნულად ითვლება");
  assert.equal(realCost(100, 200), 10, "90%-ზე მეტი არ გადის");
  assert.equal(realCost(null, 10), null);
  assert.equal(realCost(0, 10), null);
});

test("ყველაზე იაფი მიმწოდებელი ნამდვილი თვითღირებულებით ირჩევა", () => {
  // ა: 100₾ ფასდაკლების გარეშე; ბ: 105₾ მაგრამ 10% ფასდაკლებით = 94.5₾
  assert.ok(realCost(105, 10)! < realCost(100, 0)!, "ბ უფრო იაფია, თუმცა ფასი მაღალი უწერია");
});

test("ორფასიან მიმწოდებელს ფასდაკლება არ ედება — სადილერო უკვე თვითღირებულებაა", () => {
  // ინტელკომი: სადილერო 748, საცალო 853. 10% რომ დავაყენოთ, არაფერი უნდა შეიცვალოს.
  assert.equal(realCost(748, 10, 853), 748, "ორი ფასი — ვარაუდი ზედმეტია");
  assert.equal(realCost(748, 10, null), 673.2, "ერთი ფასი — ფასდაკლება ედება");
  assert.equal(realCost(748, 10, 748), 673.2, "საცალო ტოლია — ნამდვილი საცალო არ მოგვცეს");
  assert.equal(realCost(748, 10, 700), 673.2, "საცალო სადილეროზე დაბლა — არასწორი მონაცემი");

  const rule = { retailBase: "LIST", markupRetail: 0, markupDealer: 5 };
  const both = computePrices(rule, 748, 853, { supplierDiscount: 10, minMargin: 0 });
  assert.equal(both.cost, 748, "ორფასიანზე თვითღირებულება ხელუხლებელია");
  assert.equal(both.price, 853);
});

/* ───────────────── საცალო მოგების წილით (MARGIN) ───────────────── */

const MARGIN = { retailBase: "MARGIN", markupRetail: 5, markupDealer: 0 };
const terms = (supplierDiscount = 0, minMargin = 0) => ({ supplierDiscount, minMargin });

test("საცალო = მისი საცალო − მოგების 5%", () => {
  // ინტელკომი: ქოსთი 748, მისი საცალო 853, მოგება 105
  const r = computePrices(MARGIN, 748, 853, terms());
  assert.equal(r.price, 847.75, "853 − 0.05×105");
  assert.equal(r.cost, 748);
  assert.equal(Math.round((r.price - 748) * 100) / 100, 99.75, "მოგების 95% ჩვენთან");
});

test("ფასი ყოველთვის მიმწოდებლის საცალოზე დაბლაა", () => {
  for (const [cost, list] of [[748, 853], [10, 11], [1000, 1001], [95, 100]]) {
    const r = computePrices(MARGIN, cost, list, terms());
    assert.ok(r.price < list, `${cost}/${list}: ${r.price} >= ${list}`);
    assert.ok(r.price > cost, `${cost}/${list}: თვითღირებულებაზე დაბლა ჩამოვიდა`);
  }
});

test("თხელმარჟიანზე ფასი თვითღირებულებას არ უახლოვდება საშიშად", () => {
  // მოგება სულ 1₾; 5% = 5 თეთრი, ანუ ზარალის რისკი არ არსებობს
  const r = computePrices(MARGIN, 100, 101, terms());
  assert.equal(r.price, 100.95);
  assert.ok(r.price > 100);
});

test("ორი ფასის გარეშე MARGIN ჩვეულებრივ ფასდადებაზე ბრუნდება", () => {
  const r = computePrices(MARGIN, 100, null, terms());
  assert.equal(r.price, 105, "საცალო არ მოგვცა — 100 × 1.05");
});

test("მინიმალური მოგება ყველა წესის თავზე დგას", () => {
  const zero = { retailBase: "COST", markupRetail: 0, markupDealer: 0 };
  assert.equal(computePrices(zero, 100, null, terms()).price, 100, "იატაკის გარეშე — თვითღირებულება");
  assert.equal(computePrices(zero, 100, null, terms(0, 10)).price, 110, "10% იატაკი აწევს");
  // MARGIN-საც ეხება
  const thin = computePrices(MARGIN, 100, 101, terms(0, 10));
  assert.equal(thin.price, 110, "იატაკი მოგების წილსაც სჯობს");
});

/* ───────── ყველა საფეხური ერთი ბაზიდან: მიმწოდებლის საცალო და მისი მოგება ───────── */

test("საფეხურები მიმწოდებლის საცალოდან ითვლება და ერთმანეთზე არ ეწყობა", () => {
  // მისი საცალო 1000, ქოსთი 800 → M = 200
  const retail = computePrices({ retailBase: "MARGIN", markupRetail: 5, markupDealer: 0 }, 800, 1000);
  assert.equal(retail.price, 990, "საცალო = 1000 − 5%×200");

  const P = { price: retail.price, cost: 800, listPrice: 1000 };
  const at = (t: string) => effectivePrice(P, { priceTier: t, discountPercent: 0 }).value;

  assert.equal(at("RETAIL"), 990);
  assert.equal(at("DEALER"), 980, "1000 − 10%×200 — და არა 990-დან");
  assert.equal(at("SILVER"), 960);
  assert.equal(at("GOLD"), 940);
  assert.equal(at("PLATINUM"), 920);

  // 60% მრჩება — მიმწოდებლის მოგებიდან
  assert.equal(ourMargin(P, { priceTier: "PLATINUM", discountPercent: 0 }), 120, "200-ის 60%");
});

test("MUK-ის ნამდვილი რიცხვები", () => {
  const r = computePrices({ retailBase: "MARGIN", markupRetail: 5, markupDealer: 0 }, 662.41, 697.55);
  assert.equal(r.price, 695.79);
  const P = { price: r.price, cost: 662.41, listPrice: 697.55 };
  assert.equal(effectivePrice(P, { priceTier: "DEALER", discountPercent: 0 }).value, 694.04);
  assert.equal(effectivePrice(P, { priceTier: "PLATINUM", discountPercent: 0 }).value, 683.49);
});

test("მიმწოდებლის საცალოს გარეშე ბაზა ჩვენი საცალოა — ძველი ქცევა", () => {
  const P = { price: 100, cost: 60 };
  assert.equal(effectivePrice(P, { priceTier: "DEALER", discountPercent: 0 }).value, 96);
});

test("პარტნიორი საცალოზე ძვირს არასდროს იხდის", () => {
  // საცალო ხელით ჩამოწეულია ქოსთამდე ახლოს — საფეხურის ფორმულა მასზე მაღლა გამოვიდოდა
  const P = { price: 805, cost: 800, listPrice: 1000 };
  assert.equal(effectivePrice(P, { priceTier: "DEALER", discountPercent: 0 }).value, 805);
});

test("მოგების წილით ფასი მიმწოდებლის საცალოს ზემოთ არასდროს ადის — თუნდაც markupDealer იყოს", () => {
  // GWN7672L: ქოსთი 427.18, მისი 429.89. markupDealer 5 ძველ იატაკს 448.54-ზე წევდა.
  const r = computePrices({ retailBase: "MARGIN", markupRetail: 5, markupDealer: 5 }, 427.18, 429.89);
  assert.ok(r.price < 429.89, `ფასი ${r.price} მის საცალოზე მაღალია`);
  assert.equal(r.price, 429.75);
});
