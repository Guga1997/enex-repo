/**
 * ზედმეტი ფილტრების ჩაქრობა.
 *
 * გვერდითა ფილტრი მხოლოდ იმ მახასიათებლებს უნდა აჩვენებდეს, რომლითაც
 * მყიდველი მართლა ეძებს. დანარჩენი (დენი, ბრუნვა, შედგენილი kW, დუბლირებული
 * სიმძლავრე) პროდუქტის გვერდზე რჩება, ფილტრში — აღარ.
 *
 *   npx tsx scripts/tidy-filters.ts          — აჩვენებს
 *   npx tsx scripts/tidy-filters.ts --write  — ჩაწერს
 */
import { db } from "../src/lib/db";

const write = process.argv.includes("--write");

/** ფილტრში არ გვინდა — სახელის ზუსტი დამთხვევით */
const OFF = [
  "Stand-by სიმძლავრე (ESP)", // „სიმძლავრე (Stand-by)“ იმავეს ფილტრავს
  "Prime სიმძლავრე (PRP)",
  "სიმძლავრე kW (ESP / PRP)", // შედგენილი მნიშვნელობა
  "დენი",
  "სიმძლავრის კოეფიციენტი",
  "ბრუნვა",
  "სიხშირე",
  "ზომა (H×W×D, მმ)",
  "მიწოდების ვადა",
];

(async () => {
  for (const name of OFF) {
    const n = await db.productAttribute.count({ where: { name, filterable: true } });
    if (!n) continue;
    console.log(`  ${name}: ${n} ჩანაწერი`);
    if (write) await db.productAttribute.updateMany({ where: { name }, data: { filterable: false } });
  }
  // ერთი და იგივე მნიშვნელობა ორ სახედ („400 / 230 V“ და „400/ 230 V“) ორ ფილტრად იშლებოდა
  const norm = (v: string) =>
    v
      .replace(/\s+/g, " ")
      .replace(/\s*\/\s*/g, " / ")
      .trim();
  const all = await db.productAttribute.findMany({ select: { id: true, value: true } });
  const dirty = all.filter((a) => norm(a.value) !== a.value);
  console.log(`  მნიშვნელობის გასწორება: ${dirty.length}`);
  if (write) {
    for (const a of dirty) {
      await db.productAttribute.update({ where: { id: a.id }, data: { value: norm(a.value) } });
    }
  }
  console.log(write ? "✓ ჩაწერილია" : "— მხოლოდ ჩვენება (--write გჭირდება)");
  await db.$disconnect();
})();
