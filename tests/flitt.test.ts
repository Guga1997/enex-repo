/**
 * Flitt-ის ხელმოწერა — დოკუმენტაციის მაგალითზე (docs.flitt.com/api/building-signature).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";
import { flittSignature, verifyFlittSignature } from "../src/lib/payments/flitt";

const docExample = {
  server_callback_url: "http://myshop/callback/",
  order_id: "TestOrder2",
  currency: "GEL",
  merchant_id: 1549901,
  order_desc: "Test payment",
  amount: 1000,
};

test("ხელმოწერა ემთხვევა დოკუმენტაციის სტრიქონს", () => {
  // დოკუმენტაციის სტრიქონი; იქვე დაბეჭდილი ჰეში (91ea7da4…) ამ სტრიქონს არ შეესაბამება —
  // ალგორითმი ნამდვილ გასაღებზე Flitt-ის API-თ შემოწმდა
  const docString = "test|1000|GEL|1549901|Test payment|TestOrder2|http://myshop/callback/";
  assert.equal(flittSignature("test", docExample), createHash("sha1").update(docString).digest("hex"));
});

test("ცარიელი ველი და signature ხელმოწერაში არ შედის, 0 შედის", () => {
  const base = flittSignature("test", docExample);
  assert.equal(flittSignature("test", { ...docExample, lang: "", rectoken: null, signature: "x" }), base);
  assert.notEqual(flittSignature("test", { ...docExample, fee: 0 }), base);
});

test("callback-ის შემოწმება: response_signature_string იგნორდება, შეცვლილი თანხა ვარდება", () => {
  const cb = { order_id: "ORD-1", order_status: "approved", amount: "1500", currency: "GEL", merchant_id: 1549901 };
  const signed = { ...cb, signature: flittSignature("test", cb), response_signature_string: "**|1500|…" };
  assert.ok(verifyFlittSignature(signed, "test"));
  assert.ok(!verifyFlittSignature({ ...signed, amount: "1" }, "test"));
  assert.ok(!verifyFlittSignature(signed, "other"));
  assert.ok(!verifyFlittSignature(signed, ""));
});
