/**
 * „ჩემი მარაგი“: მიმწოდებლის ნაშთს ემატება, სინქს გადაურჩება, გაყიდვისას პირველი აკლდება.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rolledUpQty, splitSale } from "../src/lib/stock";

test("სულ = მიმწოდებელი + ჩემი; სინქზე მიმწოდებლის ციფრი იცვლება, ჩემი რჩება", () => {
  assert.equal(rolledUpQty([10], 4), 14);
  assert.equal(rolledUpQty([6], 4), 10);
  assert.equal(rolledUpQty([10, 2], 0), 12);
});

test("გაყიდვა: ჯერ ჩემი მარაგი, სანამ არ განულდება", () => {
  assert.deepEqual(splitSale(4, [10], 1), { own: 3, supplies: [10] });
  assert.deepEqual(splitSale(4, [10], 4), { own: 0, supplies: [10] });
});

test("გაყიდვა: ჩემი რომ არ ყოფნის, დარჩენილი მიმწოდებელს აკლდება", () => {
  assert.deepEqual(splitSale(4, [10], 6), { own: 0, supplies: [8] });
  assert.deepEqual(splitSale(0, [10], 2), { own: 0, supplies: [8] });
});

test("რამდენიმე მიმწოდებელი — რიგრიგობით; მიმწოდებლის გარეშე პროდუქტი არ ვარდება", () => {
  assert.deepEqual(splitSale(1, [3, 2], 5), { own: 0, supplies: [0, 1] });
  assert.deepEqual(splitSale(0, [], 2), { own: 0, supplies: [] });
});
