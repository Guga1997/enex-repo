/**
 * კაბელების შეკვეთის წესი: ელექტრო — კვეთის მიხედვით 100 ან 10 მ, ქსელის — მხოლოდ შეკვრით.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cableOrderRule, cableSectionMm2 } from "../src/lib/order-rules";
import { isPurchasable, normalizeQty, stockLabel } from "../src/lib/stock";

const E = ["ენერგო უზრუნველყოფა", "კაბელი", "სამონტაჟო კაბელი", "NYM"];
const thin = { minQty: 100, qtyStep: 1, unit: "მ" };
const thick = { minQty: 10, qtyStep: 1, unit: "მ" };
const reel = { minQty: 305, qtyStep: 305, unit: "მ" };

test("კვეთი სახელიდან", () => {
  assert.equal(cableSectionMm2("ელ. სადენი NYM 2X1.5"), 1.5);
  assert.equal(cableSectionMm2("ელ. სადენი N2XH 5X16"), 16);
  assert.equal(cableSectionMm2("ელ. სადენი АВВГ 3X35+1X16"), 35);
  assert.equal(cableSectionMm2("ელ. სადენი YVV (NYY) FLEX 1X240"), 240);
  assert.equal(cableSectionMm2("ელ. სადენი NA2XSEY 6/10 kV 3X70/16"), 70);
  assert.equal(cableSectionMm2("ელ. სადენი H05VVH2-F 2X4 - ELVARE"), 4);
  assert.equal(cableSectionMm2("ელ. სადენი ACSR 35/6.2"), 35);
  assert.equal(cableSectionMm2("ელ. სადენი H07V-K 1х2,5"), 2.5);
  assert.equal(cableSectionMm2("უცნობი კაბელი"), null);
});

test("ელექტრო: 10 მმ²-მდე 100 მ, 10 მმ²-დან 10 მ", () => {
  assert.deepEqual(cableOrderRule(E, 2, "NYM 2X1.5"), thin);
  assert.deepEqual(cableOrderRule(E, 5, "N2XH 3X6"), thin);
  assert.deepEqual(cableOrderRule(E, 1, "H05VV-F 2X0.75"), thin);
  assert.deepEqual(cableOrderRule(E, 9, "N2XH 5X10"), thick);
  assert.deepEqual(cableOrderRule(E, 50, "АВВГ 3X95+1X50"), thick);
  assert.deepEqual(cableOrderRule(["ენერგო უზრუნველყოფა", "კაბელი", "მაღალი ძაბვის კაბელი"], 50, "NA2XSEY 6/10 kV 3X70/16"), thick);
  assert.deepEqual(cableOrderRule(E, 2, "უცნობი"), thin);
});

test("ქსელის მხოლოდ შეკვრით; შეკვრაზე დაფასებული და სხვა კაბელები უცვლელია", () => {
  assert.deepEqual(cableOrderRule(["LAN & WAN", "LAN კაბელები", "LAN კაბელები 100% სპილენძით"], 1.35, "Cat5e 305 მეტრი"), reel);
  assert.equal(cableOrderRule(["LAN & WAN", "LAN კაბელები"], 137.42, "Cat5e 305 მეტრი"), null);
  assert.equal(cableOrderRule(["ენერგო უზრუნველყოფა", "კაბელი", "საკომუნიკაციო კაბელი"], 1, "LIYY 4x0.22"), null);
  assert.equal(cableOrderRule(["ოპტიკური ქსელი", "ოპტიკური კაბელები"], 2, "ADSS"), null);
});

test("რაოდენობა ჯდება მინიმუმსა და შეკვრაზე", () => {
  assert.equal(normalizeQty(1, thin), 100);
  assert.equal(normalizeQty(137, thin), 137);
  assert.equal(normalizeQty(1, thick), 10);
  assert.equal(normalizeQty(1, reel), 305);
  assert.equal(normalizeQty(400, reel), 610);
  assert.equal(normalizeQty(610, reel), 610);
  assert.equal(normalizeQty(3, {}), 3);
});

test("ნაშთი ზღუდავს — შეკვრა მთლიანი უნდა დაეტიოს", () => {
  assert.equal(normalizeQty(5000, reel, 1460), 1220);
  assert.equal(normalizeQty(500, thin, 180), 180);
  assert.equal(normalizeQty(100, thin, 99), 0);
  assert.equal(normalizeQty(305, reel, 176), 0);
});

test("მინიმუმზე ნაკლები ნაშთი ვეღარ იყიდება", () => {
  const base = { stockStatus: "IN_STOCK", reservedQty: 0 };
  assert.equal(isPurchasable({ ...base, stockQty: 99, minQty: 100 }), false);
  assert.equal(isPurchasable({ ...base, stockQty: 100, minQty: 100 }), true);
  assert.equal(isPurchasable({ ...base, stockQty: 120, reservedQty: 30, minQty: 100 }), false);
  assert.equal(isPurchasable({ ...base, stockQty: 1 }), true);
  assert.equal(stockLabel({ ...base, stockQty: 99, minQty: 100 }).tone, "none");
  assert.equal(stockLabel({ ...base, stockQty: 500, minQty: 100 }).tone, "ok");
});
