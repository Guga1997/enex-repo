/**
 * პროდუქტების თარგმანის ჩაწერა ბაზაში ფაილიდან: [{ id, en, ru }, ...]
 *
 *   npx tsx scripts/import-translations.ts names.json name          — nameEn / nameRu
 *   npx tsx scripts/import-translations.ts desc.json description    — descriptionEn / descriptionRu
 *   ... --write   — ჩაწერა (მის გარეშე მხოლოდ ითვლის)
 *   ... --force   — არსებული თარგმანიც გადაიწერება
 *
 * მიმწოდებლის სინქი თარგმანს მხოლოდ ახალ პროდუქტზე წერს, ამიტომ ჩაწერილი თარგმანი შემდეგ სინქზე არ იკარგება.
 */
import { readFileSync } from "fs";
import { db } from "../src/lib/db";

const [file, kind] = process.argv.slice(2);
const write = process.argv.includes("--write");
const force = process.argv.includes("--force");
if (!file || (kind !== "name" && kind !== "description")) {
  console.error("გამოყენება: import-translations.ts <file.json> name|description [--write] [--force]");
  process.exit(1);
}
const en = kind === "name" ? "nameEn" : "descriptionEn";
const ru = kind === "name" ? "nameRu" : "descriptionRu";

(async () => {
  const rows = JSON.parse(readFileSync(file, "utf8")) as { id: string; en: string; ru: string }[];
  let updated = 0, skipped = 0, missing = 0;
  for (const r of rows) {
    const p = await db.product.findUnique({ where: { id: r.id }, select: { id: true, [en]: true, [ru]: true } });
    if (!p) { missing++; continue; }
    const data: Record<string, string> = {};
    if (force || !p[en as keyof typeof p]) data[en] = r.en;
    if (force || !p[ru as keyof typeof p]) data[ru] = r.ru;
    if (!Object.keys(data).length) { skipped++; continue; }
    if (write) await db.product.update({ where: { id: r.id }, data });
    updated++;
  }
  console.log(`${write ? "ჩაიწერა" : "ჩაიწერებოდა"}: ${updated}, უკვე ნათარგმნი: ${skipped}, ვერ მოიძებნა: ${missing}`);
  await db.$disconnect();
})();
