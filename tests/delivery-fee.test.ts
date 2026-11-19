/** მიწოდების საფასური: თბილისი 15 ₾, თბილისის გარეთ 40 ₾, გატანა და 200 ₾-დან — უფასო */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DELIVERY_CITIES, deliveryFeeFor } from "../src/lib/constants";

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
