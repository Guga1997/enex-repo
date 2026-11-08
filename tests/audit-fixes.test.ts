/**
 * აუდიტის გასწორებების წმინდა ფუნქციები: ფილტრის მნიშვნელობები, დაბრუნების შენიშვნა,
 * შიდა ქსელის მისამართები, ფაილის შიგთავსის შემოწმება, Excel-ის რიცხვები, API-ს ფასის წესი.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitFilter, joinFilter } from "../src/lib/filter-values";
import { returnNote } from "../src/lib/return-terms";
import { isPrivateIp, sniffOk } from "../src/lib/media";
import { num } from "../src/lib/suppliers/spreadsheet";
import { checkPrice } from "../src/lib/api-write";
import { withLocale } from "../src/lib/i18n/config";

test("ფილტრი: მძიმიანი მნიშვნელობა მთლიანად ითვლება", () => {
  assert.deepEqual(splitFilter("2,5 მმ²|4 მმ²"), ["2,5 მმ²", "4 მმ²"]);
  assert.ok(splitFilter("2,5 მმ²").includes("2,5 მმ²")); // ძველი ბმული
  assert.deepEqual(splitFilter("hikvision,dahua").slice(1), ["hikvision", "dahua"]);
  assert.deepEqual(splitFilter("dahua"), ["dahua"]);
  assert.deepEqual(splitFilter(""), []);
  assert.equal(joinFilter(["a", "b,c"]), "a|b,c");
});

test("დაბრუნების შენიშვნა პროდუქტის გვერდზე", () => {
  assert.ok(returnNote({ nameKa: "კაბელი", unit: "მ", qtyStep: 1, categoryNames: [] }).restricted);
  assert.equal(returnNote({ nameKa: "კაბელი 305მ", unit: "მ", qtyStep: 305, categoryNames: [] }).restricted, undefined);
  assert.ok(returnNote({ nameKa: "NVR License 16ch", categoryNames: [] }).restricted);
  assert.ok(returnNote({ nameKa: "RFID ბარათი", categoryNames: ["სასტუმროს სისტემები"] }).restricted);
  assert.equal(returnNote({ nameKa: "სეიფი", categoryNames: ["სასტუმროს სისტემები"] }).restricted, undefined);
  assert.equal(returnNote({ nameKa: "გენერატორი", categoryNames: ["დიზელის გენერატორები"] }).bulky, true);
  assert.equal(returnNote({ nameKa: "აკუმულატორი", weightKg: 45, categoryNames: [] }).bulky, true);
  assert.deepEqual(returnNote({ nameKa: "კამერა", weightKg: 0.5, categoryNames: [] }), {});
});

test("შიდა ქსელის მისამართები იბლოკება", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ["2.29.40.137", "8.8.8.8", "172.32.0.1", "2a01:4f9::1"]) assert.equal(isPrivateIp(ip), false, ip);
});

test("ფაილის შიგთავსი ტიპს უნდა ემთხვეოდეს", () => {
  assert.equal(sniffOk(Buffer.from("ffd8ffe000104a46", "hex"), ".jpg"), true);
  assert.equal(sniffOk(Buffer.from("89504e470d0a1a0a", "hex"), ".png"), true);
  assert.equal(sniffOk(Buffer.from("%PDF-1.7"), ".pdf"), true);
  assert.equal(sniffOk(Buffer.from("<html><script>"), ".jpg"), false);
  assert.equal(sniffOk(Buffer.from("<svg onload=x>"), ".svg"), false);
});

test("Excel-ის რიცხვები: ათასები და ათწილადი", () => {
  assert.equal(num("1,234"), 1234);
  assert.equal(num("1,234.50"), 1234.5);
  assert.equal(num("1.234,50"), 1234.5);
  assert.equal(num("12,5"), 12.5);
  assert.equal(num("€ 1 299,00"), 1299);
  assert.equal(num(""), null);
});

test("API-ს ფასი: 0 და ქოსთზე დაბლა არ მიიღება", () => {
  assert.equal(checkPrice(0, null) !== null, true);
  assert.equal(checkPrice(90, 100) !== null, true);
  assert.equal(checkPrice(100, 100), null);
  assert.equal(checkPrice(50, null), null);
});

test("ენის პრეფიქსი ორჯერ არ ედება", () => {
  assert.equal(withLocale("/checkout", "en"), "/en/checkout");
  assert.equal(withLocale("/en/checkout", "en"), "/en/checkout");
  assert.equal(withLocale("/login?next=/en/checkout", "ru"), "/ru/login?next=/en/checkout");
  assert.equal(withLocale("/", "ru"), "/ru");
  assert.equal(withLocale("/catalog", "ka"), "/catalog");
});
