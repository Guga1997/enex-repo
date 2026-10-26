/**
 * მახასიათებლებისა და აღწერის თარგმანი — ერთეულების წესები, ლექსიკონი,
 * HTML-ის ნარჩენები და /en-/ru-ზე ქართული აღწერის დამალვა.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { translateAttr, attrLabels } from "../src/lib/i18n/attributes";
import { descriptionOf, nameOf, plainText } from "../src/lib/i18n/content";

test("სახელი დიდი ასოთი, iPhone-ის ტიპი უცვლელად", () => {
  assert.equal(nameOf({ nameKa: "ქ", nameRu: "настенный кронштейн" }, "ru"), "Настенный кронштейн");
  assert.equal(nameOf({ nameKa: "ქ", nameEn: "iPhone case" }, "en"), "iPhone case");
  assert.equal(nameOf({ nameKa: "ქ", nameEn: null }, "en"), "ქ");
});

test("ერთეულები წესით: მმ, მ, მპ, დიაპაზონი", () => {
  assert.equal(translateAttr("2.8 მმ", "en"), "2.8 mm");
  assert.equal(translateAttr("30მ", "ru"), "30 м");
  assert.equal(translateAttr("4 მპ", "en"), "4 MP");
  assert.equal(translateAttr("-10°C-დან +55°C-მდე", "en"), "-10°C to +55°C");
  assert.equal(translateAttr("-10°C-დან +55°C-მდე", "ru"), "от -10°C до +55°C");
  assert.equal(translateAttr("60მ-მდე", "en"), "up to 60 m");
});

test("ლექსიკონი (data/attr-i18n.json) და ქართული უცვლელად", () => {
  assert.equal(translateAttr("მიკროფონი", "en"), "Microphone");
  assert.equal(translateAttr("დიახ", "ru"), "Да");
  assert.equal(translateAttr("მიკროფონი", "ka"), "მიკროფონი");
  // უცნობი ფრაზა ნახევრად არ ითარგმნება
  assert.equal(translateAttr("ზღაპრული სიტყვა 30 მ", "en"), "ზღაპრული სიტყვა 30 მ");
  assert.equal(translateAttr("PoE+", "en"), "PoE+");
});

test("attrLabels — მხოლოდ ნათარგმნი", () => {
  assert.deepEqual(attrLabels(["მიკროფონი", "IP67"], "en"), { "მიკროფონი": "Microphone" });
  assert.deepEqual(attrLabels(["მიკროფონი"], "ka"), {});
});

test("plainText: HTML ენთითები და ტეგები", () => {
  assert.equal(plainText("&bull; Smart&nbsp;ფუნქციები<br>IP67 &amp; WDR"), "• Smart ფუნქციები\nIP67 & WDR");
});

test("აღწერა: თარგმანი, ან /en-ზე არაფერი — ქართული არა", () => {
  const p = { descriptionKa: "ქართული აღწერა", descriptionEn: null, descriptionRu: "Русское описание" };
  assert.equal(descriptionOf(p, "ka"), "ქართული აღწერა");
  assert.equal(descriptionOf(p, "en"), null);
  assert.equal(descriptionOf(p, "ru"), "Русское описание");
  // ლათინური აღწერა ყველა ენაზე ჩანს
  assert.equal(descriptionOf({ descriptionKa: "IP67, 4MP" }, "en"), "IP67, 4MP");
});
