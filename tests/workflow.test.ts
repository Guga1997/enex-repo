/**
 * შეკვეთის პროცესის წესები — ვინ რას აკეთებს და ვინ რას ხედავს.
 * წყარო: „ონლაინ მაღაზიის შეკვეთის პროცესი“ (10 ნაბიჯი, ოთხი განყოფილება).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { STEP_DEFS, canDo, canSee, currentStep, isOpen, stepDef, type Step } from "../src/lib/workflow";

const done = (...steps: Step[]) => new Set<string>(steps);

test("ნაბიჯების რიგი PDF-ის სქემას მიჰყვება", () => {
  assert.deepEqual(
    STEP_DEFS.map((s) => s.no),
    [2, 4, 5, 7, 8, 9, 10]
  );
  assert.equal(stepDef("PAYMENT_CONFIRMED").role, "ACCOUNTING");
  assert.equal(stepDef("SUPPLIER_INVOICE").role, "PURCHASING");
  assert.equal(stepDef("DELIVERY_REQUEST").role, "SALES");
  assert.equal(stepDef("DELIVERED").role, "DELIVERY");
});

test("ნაბიჯს მხოლოდ თავისი განყოფილება ასრულებს, ადმინი — ყველას", () => {
  assert.equal(canDo("ACCOUNTING", "PAYMENT_CONFIRMED"), true);
  assert.equal(canDo("SALES", "PAYMENT_CONFIRMED"), false);
  assert.equal(canDo("PURCHASING", "SUPPLIER_INVOICE"), true);
  assert.equal(canDo("DELIVERY", "SUPPLIER_INVOICE"), false);
  for (const d of STEP_DEFS) assert.equal(canDo("ADMIN", d.step), true);
});

test("რიგის გადახტომა არ შეიძლება", () => {
  assert.equal(isOpen("PAYMENT_CONFIRMED", done()), true, "პირველი ნაბიჯი თავიდანვე ღიაა");
  assert.equal(isOpen("SUPPLIER_INVOICE", done()), false, "გადახდის დადასტურებამდე დაკეტილია");
  assert.equal(isOpen("SUPPLIER_INVOICE", done("PAYMENT_CONFIRMED")), true);
  assert.equal(isOpen("WAYBILL", done("PAYMENT_CONFIRMED", "SUPPLIER_INVOICE")), false);
  assert.equal(isOpen("PAYMENT_CONFIRMED", done("PAYMENT_CONFIRMED")), false, "შესრულებული აღარ იხსნება");
});

test("მიმდინარე ნაბიჯი პირველი შეუსრულებელია", () => {
  assert.equal(currentStep(done())?.step, "PAYMENT_CONFIRMED");
  assert.equal(currentStep(done("PAYMENT_CONFIRMED"))?.step, "SUPPLIER_INVOICE");
  assert.equal(currentStep(done(...STEP_DEFS.map((s) => s.step))), null);
});

test("მომწოდებლის ინვოისს მხოლოდ შესყიდვები და ბუღალტერია ხედავს", () => {
  for (const r of ["PURCHASING", "ACCOUNTING", "ADMIN"]) {
    assert.equal(canSee(r, "supplierInvoice", done()), true, r);
  }
  for (const r of ["SALES", "DELIVERY"]) {
    assert.equal(canSee(r, "supplierInvoice", done()), false, r);
  }
});

test("გაყიდვები აღების მისამართს გადარიცხვის შემდეგ ხედავს", () => {
  assert.equal(canSee("SALES", "pickup", done("PAYMENT_CONFIRMED")), false);
  assert.equal(canSee("SALES", "pickup", done("PAYMENT_CONFIRMED", "SUPPLIER_INVOICE", "SUPPLIER_PAID")), true);
  assert.equal(canSee("PURCHASING", "pickup", done()), true, "შესყიდვები თავიდანვე ხედავს");
});

test("მიწოდება შეკვეთას მხოლოდ განაცხადის შემდეგ ხედავს", () => {
  assert.equal(canSee("DELIVERY", "order", done("SUPPLIER_PAID")), false);
  assert.equal(canSee("DELIVERY", "order", done("DELIVERY_REQUEST")), true);
  assert.equal(canSee("DELIVERY", "payment", done("DELIVERY_REQUEST")), false, "გადახდის დასტური მიწოდებას არ ეხება");
});

test("ყველა ნაბიჯი თავის რიგზე იხსნება — სრული გავლა", () => {
  const acc = new Set<string>();
  for (const d of STEP_DEFS) {
    assert.equal(isOpen(d.step, acc), true, `${d.no}. ${d.title} ვერ გაიხსნა`);
    acc.add(d.step);
  }
  assert.equal(currentStep(acc), null);
});
