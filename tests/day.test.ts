/**
 * დღის საზღვრები თბილისის დროით — სერვერი UTC-ზეა და ღამის შეკვეთა
 * „გუშინდელში“ არ უნდა ჩავარდეს.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dayLabel, dayRange, isDay, today } from "../src/lib/day";

test("დღე 00:00-დან 24:00-მდე თბილისის დროით იზომება", () => {
  const { gte, lt } = dayRange("2026-09-29");
  assert.equal(gte.toISOString(), "2026-09-28T20:00:00.000Z", "თბილისში 29-ის 00:00 = UTC 28-ის 20:00");
  assert.equal(lt.toISOString(), "2026-09-29T20:00:00.000Z");
});

test("ღამის ერთზე გაკეთებული შეკვეთა იმავე დღეშია", () => {
  const { gte, lt } = dayRange("2026-09-29");
  const order = new Date("2026-09-28T21:30:00.000Z"); // თბილისში 29 სექტემბერი, 01:30
  assert.ok(order >= gte && order < lt);
});

test("შუალედი ბოლო დღესაც იტევს", () => {
  const { gte, lt } = dayRange("2026-09-01", "2026-09-30");
  assert.equal(gte.toISOString(), "2026-08-31T20:00:00.000Z");
  assert.equal(lt.toISOString(), "2026-09-30T20:00:00.000Z");
  const last = new Date("2026-09-30T19:00:00.000Z"); // 30 სექტემბერი, 23:00
  assert.ok(last < lt);
});

test("თარიღის ფორმატი მოწმდება", () => {
  assert.equal(isDay("2026-09-29"), true);
  for (const bad of ["", "2026-9-9", "29.09.2026", "abc", undefined, null]) {
    assert.equal(isDay(bad), false, String(bad));
  }
  assert.equal(isDay(today()), true);
});

test("ეტიკეტი ქართული ფორმატითაა", () => {
  assert.equal(dayLabel("2026-09-29"), "29.09.2026");
});
