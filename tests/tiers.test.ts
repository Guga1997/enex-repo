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

  const without = computePrices(rule, 100, null, 0);
  const with10 = computePrices(rule, 100, null, 10);

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
