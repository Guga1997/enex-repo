/**
 * კაბელების შეკვეთის წესის გავრცელება არსებულ პროდუქტებზე (იხ. order-rules.ts).
 * ახალს სინქი თვითონ ადებს შექმნისას.
 *
 *   npx tsx scripts/apply-cable-rules.ts            — მხოლოდ ანგარიში
 *   npx tsx scripts/apply-cable-rules.ts --write    — ჩაწერა
 */
import { db } from "../src/lib/db";
import { cableOrderRule } from "../src/lib/order-rules";
import { availableQty } from "../src/lib/stock";

(async () => {
  const write = process.argv.includes("--write");
  const cats = await db.category.findMany({ select: { id: true, nameKa: true, parentId: true } });
  const byId = new Map(cats.map((c) => [c.id, c]));
  const chainOf = (id: string) => {
    const out: string[] = [];
    for (let c = byId.get(id); c; c = c.parentId ? byId.get(c.parentId) : undefined) out.unshift(c.nameKa);
    return out;
  };
  const products = await db.product.findMany({
    select: {
      id: true, nameKa: true, price: true, categoryId: true, stockQty: true,
      reservedQty: true, stockStatus: true, isActive: true,
    },
  });
  const counts: Record<string, number> = {};
  const belowMin: string[] = [];
  for (const p of products) {
    const rule = cableOrderRule(chainOf(p.categoryId), p.price, p.nameKa);
    if (!rule) continue;
    const key = `მინ ${rule.minQty} / ბიჯი ${rule.qtyStep}`;
    counts[key] = (counts[key] ?? 0) + 1;
    const avail = availableQty(p);
    if (p.isActive && p.stockStatus === "IN_STOCK" && avail > 0 && avail < rule.minQty) {
      belowMin.push(`${avail} მ < ${rule.minQty} | ${p.nameKa.slice(0, 70)}`);
    }
    if (write) await db.product.update({ where: { id: p.id }, data: rule });
  }
  console.log(write ? "ჩაიწერა" : "ანგარიში (--write არ არის)", counts);
  console.log(`ნაშთი მინიმუმზე ნაკლებია — ვეღარ იყიდება: ${belowMin.length}`);
  belowMin.forEach((l) => console.log("  " + l));
  await db.$disconnect();
})();
