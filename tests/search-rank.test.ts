/**
 * ძებნის შედეგების რიგი: მთავარი ნივთი აქსესუარზე წინ, ზუსტი კოდი ყველაზე წინ,
 * შეცდომით აკრეფილი ბრენდი სწორდება.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { closestWord, editDistance, rankIds, relevance, type RankRow } from "../src/lib/search-rank";
import { searchTerms } from "../src/lib/search-terms";

let n = 0;
const row = (nameKa: string, category: string, extra: Partial<RankRow> & { parent?: string } = {}): RankRow => ({
  id: String(++n), sku: `S${n}`, model: null, nameKa, nameEn: null, nameRu: null, price: 100, sortOrder: 0,
  stockStatus: "IN_STOCK", stockQty: 5, reservedQty: 0, brand: null,
  category: { nameKa: category, nameEn: null, nameRu: null, parent: extra.parent ? { nameKa: extra.parent, nameEn: null, nameRu: null } : null },
  ...extra,
});
const order = (rows: RankRow[], q: string) => {
  const by = new Map(rows.map((r) => [r.id, r.nameKa]));
  return rankIds(rows, q).map((id) => by.get(id));
};

test("„კამერა“: კამერა წინ, სამაგრი და ყუთი უკან — ფასის მიუხედავად", () => {
  const rows = [
    row("ბულეტ კამერის ბოძზე სამაგრი", "სამაგრები და აქსესუარები", { price: 5 }),
    row("წყალგაუმტარი კაბელის დამჭერი კამერებისთვის", "სამაგრები და აქსესუარები", { price: 1 }),
    row("IP კამერა - 4მპ, 2.8მმ, Dome", "IP კამერები", { price: 300 }),
    row("კვების ბლოკი ანალოგური კამერებისთვის", "კვების ბლოკები ანალოგური კამერებისთვის", { price: 20 }),
  ];
  assert.equal(order(rows, "კამერა")[0], "IP კამერა - 4მპ, 2.8მმ, Dome");
  assert.equal(order(rows, "კამერები")[0], "IP კამერა - 4მპ, 2.8მმ, Dome");
});

test("„ssd“: SSD დისკი ლეპტოპზე წინ, HDD საერთოდ არ ეძებს", () => {
  const ssd = row("Kingston 480G DC600M 2.5” Enterprise SATA SSD", "SSD დისკები");
  const laptop = row("Dell Pro 14 /16GB/512GB SSD/FHD", "ლეპტოპები", { price: 1 });
  assert.ok(relevance(ssd, "ssd") > relevance(laptop, "ssd"));
  assert.ok(!searchTerms("ssd")[0].variants.includes("hdd"));
  assert.ok(searchTerms("დისკი")[0].variants.includes("დისკ"));
});

test("ზუსტი კოდი/მოდელი ყველაფერზე წინ დგას", () => {
  const exact = row("IP კამერა - 2მპ, Bullet", "IP კამერები", { model: "IPC-B121H" });
  const longer = row("IP კამერა - 2მპ, Bullet, Eco", "IP კამერები", { model: "IPC-B121H-C" });
  const mention = row("სამაგრი IPC-B121H კამერისთვის", "სამაგრები და აქსესუარები");
  assert.deepEqual(order([mention, longer, exact], "ipc-b121h"), [exact.nameKa, longer.nameKa, mention.nameKa]);
  assert.equal(relevance(exact, "ipc b121h") > 0, true);
});

test("კატეგორიით ნაპოვნი ნივთი სახელში შემთხვევით ნახსენებზე წინ", () => {
  const laptop = row("Dell Latitude 7330 Rugged/13.3 FHD", "ლეპტოპები", { parent: "კომპიუტერები და ლეპტოპები" });
  const bag = row("Dell Rugged Notebook Escape Backpack", "ჩანთები და ზურგჩანთები", { parent: "კომპიუტერები და ლეპტოპები" });
  assert.deepEqual(order([bag, laptop], "ლეპტოპი"), [laptop.nameKa, bag.nameKa]);
});

test("ტოლ ქულაზე მარაგში მყოფი წინ", () => {
  const out = row("IP კამერა - A", "IP კამერები", { stockStatus: "OUT_OF_STOCK", stockQty: 0, price: 1 });
  const inn = row("IP კამერა - B", "IP კამერები", { price: 500 });
  assert.deepEqual(order([out, inn], "კამერა"), [inn.nameKa, out.nameKa]);
});

test("შეცდომით აკრეფილი სიტყვა", () => {
  const known = ["hikvision", "dahua", "uniview", "kingston", "კამერები"];
  assert.equal(closestWord("hikvison", known), "hikvision");
  assert.equal(closestWord("kingstno", known), "kingston");
  assert.equal(closestWord("dahua", known), null); // სწორია — არ ვცვლით
  assert.equal(closestWord("ups", known), null); // მოკლე სიტყვას არ ვეხებით
  assert.equal(closestWord("samsung", known), null); // ახლოს არაფერია
  assert.equal(editDistance("hikvison", "hikvision"), 1);
});
