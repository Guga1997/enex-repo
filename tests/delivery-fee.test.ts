/** მიწოდების საფასური: თბილისი 15 ₾, თბილისის გარეთ 40 ₾, გატანა და 200 ₾-დან — უფასო */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DELIVERY_CITIES, deliveryFeeFor, isBulkyDelivery } from "../src/lib/constants";

test("თბილისი 15 ₾, ნებისმიერი სხვა ქალაქი 40 ₾", () => {
  assert.equal(deliveryFeeFor("COURIER", "თბილისი", 50), 15);
  assert.equal(deliveryFeeFor("COURIER", " თბილისი ", 199.99), 15);
  for (const c of DELIVERY_CITIES.filter((c) => c !== "თბილისი")) assert.equal(deliveryFeeFor("COURIER", c, 50), 40, c);
  // ქალაქი უცნობია — იაფი ტარიფი შემთხვევით არ გაიცეს
  assert.equal(deliveryFeeFor("COURIER", "", 50), 40);
  assert.equal(deliveryFeeFor("COURIER", null, 50), 40);
});

test("გატანა და 200 ₾-დან — უფასო, ქალაქის მიუხედავად", () => {
  assert.equal(deliveryFeeFor("PICKUP", "ბათუმი", 50), 0);
  assert.equal(deliveryFeeFor("COURIER", "ბათუმი", 200), 0);
  assert.equal(deliveryFeeFor("COURIER", "თბილისი", 350), 0);
});

test("მსხვილი ტექნიკა: თბილისი 40, სხვაგან 80 — თანხის მიუხედავად; გატანა უფასოა", () => {
  assert.equal(deliveryFeeFor("COURIER", "თბილისი", 1799, true), 40);
  assert.equal(deliveryFeeFor("COURIER", "ბათუმი", 1799, true), 80);
  assert.equal(deliveryFeeFor("COURIER", "სხვა", 150, true), 80);
  assert.equal(deliveryFeeFor("COURIER", null, 5000, true), 80);
  assert.equal(deliveryFeeFor("PICKUP", "ბათუმი", 1799, true), 0);
  // ჩვეულებრივი ნივთი ძველი წესით რჩება
  assert.equal(deliveryFeeFor("COURIER", "თბილისი", 1799, false), 0);
});

test("მსხვილი ტექნიკის კატეგორია — თვითონ ან მშობელი", () => {
  assert.equal(isBulkyDelivery({ category: { slug: "macivrebi" } }), true);
  assert.equal(isBulkyDelivery({ category: { slug: "x", parent: { slug: "televizorebi" } } }), true);
  assert.equal(isBulkyDelivery({ category: { slug: "tv-boxes-and-smart-tv", parent: { slug: "audio-video" } } }), false);
  assert.equal(isBulkyDelivery({ category: { slug: "yavis-aparatebi", parent: { slug: "sayofackhovrebo-teqnika" } } }), false);
  assert.equal(isBulkyDelivery({}), false);
});
