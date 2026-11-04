/**
 * ხელით კორექცია მარაგზე: სინქი ნაშთს თავიდან ითვლის, კორექცია უნდა გადარჩეს.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { adjustAfterSale, planStockAdjust, rolledUpQty } from "../src/lib/stock";

test("კორექცია მიმწოდებლების ჯამს ემატება და სინქის შემდეგაც რჩება", () => {
  const adjust = planStockAdjust([10, 2], 15);
  assert.equal(adjust, 3);
  assert.equal(rolledUpQty([10, 2], adjust), 15);
  // მიმწოდებელმა ნაშთი შეცვალა — ჩვენი +3 იგივეა
  assert.equal(rolledUpQty([4, 2], adjust), 9);
});

test("მოკლება: უარყოფითი კორექცია, ნაშთი ნულზე დაბლა ვერ ჩავა", () => {
  const adjust = planStockAdjust([10], 7);
  assert.equal(adjust, -3);
  assert.equal(rolledUpQty([10], adjust), 7);
  assert.equal(rolledUpQty([1], adjust), 0);
});

test("მიმწოდებლის გარეშე პროდუქტს კორექცია არ აქვს", () => {
  assert.equal(planStockAdjust([], 8), 0);
});

test("გაყიდვა ჯერ ჩვენს დამატებულ მარაგს ხარჯავს", () => {
  assert.equal(adjustAfterSale(5, 2), 3);
  assert.equal(adjustAfterSale(2, 5), 0);
  assert.equal(adjustAfterSale(-3, 2), -3);
  assert.equal(adjustAfterSale(0, 2), 0);
});
