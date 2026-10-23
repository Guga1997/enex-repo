/**
 * უსურათო პროდუქტებზე ფოტოების მიბმა სიიდან და ჩვენს დისკზე ჩამოტვირთვა.
 *
 *   npx tsx scripts/attach-images.ts images.json          — ნახვა
 *   npx tsx scripts/attach-images.ts images.json --write  — მიბმა და ჩამოტვირთვა
 *
 * images.json: [{ "id": "<productId>", "sku": "...", "imgs": ["https://…", …] }]
 * სია მწარმოებლის ოფიციალური საიტიდან მზადდება (ajax.systems, dahuasecurity.com…).
 * მხოლოდ იმ პროდუქტს ეხება, რომელსაც ფოტო ჯერ კიდევ არ აქვს — ხელით ატვირთულს არ ცვლის.
 */
import { readFileSync } from "fs";
import { db } from "../src/lib/db";
import { localizeMedia } from "../src/lib/media";

const file = process.argv[2];
const WRITE = process.argv.includes("--write");
if (!file) throw new Error("ფაილი მიუთითე: npx tsx scripts/attach-images.ts images.json");

type Entry = { id: string; sku?: string; imgs: string[] };

(async () => {
  const list = (JSON.parse(readFileSync(file, "utf8")) as Entry[]).filter((e) => e.imgs?.length);
  const products = await db.product.findMany({
    where: { id: { in: list.map((e) => e.id) } },
    select: { id: true, sku: true, _count: { select: { images: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const todo = list.filter((e) => byId.get(e.id) && byId.get(e.id)!._count.images === 0);
  const skipped = list.length - todo.length;
  console.log(`სიაში: ${list.length} | მისაბმელი: ${todo.length} (ფოტო ${todo.reduce((s, e) => s + e.imgs.length, 0)}) | გამოტოვებული: ${skipped}`);
  if (!WRITE) {
    console.log("ცვლილება არ შესულა. გასაშვებად: --write");
    await db.$disconnect();
    return;
  }

  for (const e of todo) {
    await db.productImage.createMany({
      data: [...new Set(e.imgs)].map((url, i) => ({ productId: e.id, url, sortOrder: i })),
    });
  }
  const stats = await localizeMedia({ productIds: todo.map((e) => e.id) });
  console.log(`ჩამოვიდა ${stats.images.done}, ჩავარდა ${stats.images.failed}`);
  for (const err of stats.errors) console.log("  ✗ " + err);

  // ვერ ჩამოტვირთული ფოტო უცხო მისამართად არ უნდა დარჩეს — სხვის სერვერზე ვერ დავეყრდნობით
  const left = await db.productImage.deleteMany({
    where: { productId: { in: todo.map((e) => e.id) }, url: { startsWith: "http" } },
  });
  if (left.count) console.log(`მოიხსნა ${left.count} ვერ ჩამოტვირთული ფოტო`);
  await db.$disconnect();
})();
