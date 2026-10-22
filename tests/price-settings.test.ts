/**
 * საფეხურების წილები „პროდუქციის ფასებიდან“ — ბაზაში ინახება და ფასის
 * გამოთვლა მათ იყენებს.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { getTierShares, saveTierShares, shareFor } from "../src/lib/pricing-settings";
import { effectivePrice } from "../src/lib/pricing";

const KEY = "tierShares";
let backup: string | null = null;

test("შენახული წილი იკითხება და ფასს ცვლის", async () => {
  backup = (await db.setting.findUnique({ where: { key: KEY } }))?.value ?? null;

  await saveTierShares({ DEALER: 0.15, SILVER: 0.2, GOLD: 0.3, PLATINUM: 0.4 });
  assert.equal(await shareFor("DEALER"), 0.15);

  // მისი საცალო 1000, ქოსთი 800 → M = 200; დილერი 15% → 970
  const P = { price: 990, cost: 800, listPrice: 1000 };
  const v = effectivePrice(P, { priceTier: "DEALER", discountPercent: 0, share: await shareFor("DEALER") });
  assert.equal(v.value, 970);
});

test("40%-ზე მეტი არ ინახება, საცალო ყოველთვის 0-ია", async () => {
  const s = await saveTierShares({ DEALER: 0.1, SILVER: 0.2, GOLD: 0.3, PLATINUM: 0.9, RETAIL: 0.5 });
  assert.equal(s.PLATINUM, 0.4, "60% ყოველთვის ჩვენთან");
  assert.equal(s.RETAIL, 0);
});

test("viewer-ზე დაწერილი წილიც 40%-ს ვერ გადააჭარბებს", () => {
  const P = { price: 990, cost: 800, listPrice: 1000 };
  const v = effectivePrice(P, { priceTier: "PLATINUM", discountPercent: 0, share: 0.9 });
  assert.equal(v.value, 920, "1000 − 40%×200");
});

test("ბაზაში თუ არაფერია, ნაგულისხმევი მოქმედებს", async () => {
  await db.setting.deleteMany({ where: { key: KEY } });
  await saveTierShares({ DEALER: 0.1, SILVER: 0.2, GOLD: 0.3, PLATINUM: 0.4 });
  const s = await getTierShares();
  assert.deepEqual([s.DEALER, s.SILVER, s.GOLD, s.PLATINUM], [0.1, 0.2, 0.3, 0.4]);
});

after(async () => {
  if (backup) await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: backup }, update: { value: backup } });
  else await db.setting.deleteMany({ where: { key: KEY } });
  await db.$disconnect();
});
