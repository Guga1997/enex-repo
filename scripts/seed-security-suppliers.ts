/**
 * Dahua-სა და Ajax-ის ფასთა ნუსხები მიმწოდებლებად.
 *
 *   npx tsx scripts/seed-security-suppliers.ts
 *
 * ფასები დოლარშია და ლარად ეროვნული ბანკის დღიური კურსით გადაიყვანება —
 * ისევე, როგორც გენერატორებზე. ფასდადება არ ედება (0%): რაც ნუსხაშია, ის
 * ჩნდება საიტზე. საათში ერთხელ სინქი ფაილს თავიდან კითხულობს და კურსსაც
 * ანახლებს, ამიტომ ლარის ფასი თვითონ მიჰყვება დოლარს.
 *
 * ნუსხის განახლებისას: node scripts/pdf-pricelist.mjs → data/pricelists/*.xlsx
 * განახლდება, სინქი კი ავტომატურად აიღებს.
 */
import { db } from "../src/lib/db";
import { slugify } from "../src/lib/format";

const SEC = "უსაფრთხოების სისტემები";
const ALARM = "დაცვითი სიგნალიზაცია";

/**
 * სინქი კატეგორიას თვითონ არ ქმნის — მხოლოდ არსებულს ეძებს და ვერ პოვნისას
 * ზემოთ ადის. ამიტომ ხე წინასწარ უნდა არსებობდეს.
 */
async function ensureTree(path: string[]): Promise<void> {
  let parentId: string | null = null;
  for (const nameKa of path) {
    const all = await db.category.findMany({ select: { id: true, nameKa: true } });
    const hit = all.find((c) => c.nameKa.trim().toLowerCase() === nameKa.trim().toLowerCase());
    if (hit) { parentId = hit.id; continue; }
    let slug = slugify(nameKa) || `cat-${Date.now()}`;
    while (await db.category.findUnique({ where: { slug }, select: { id: true } })) slug += "-2";
    const made: { id: string } = await db.category.create({
      data: { slug, nameKa, parentId },
      select: { id: true },
    });
    console.log(`  + კატეგორია: ${path.slice(0, path.indexOf(nameKa) + 1).join(" > ")}`);
    parentId = made.id;
  }
}

/** Ajax-ის განყოფილებები ნუსხიდან — სინქამდე ქვეკატეგორიებად უნდა არსებობდეს */
const AJAX_SECTIONS = [
  "საკონტროლო პანელები",
  "სიგნალის გამაძლიერებლები",
  "გაღების დეტექტორები",
  "მინის მსხვრევის დეტექტორები",
  "მოძრაობის დეტექტორები",
  "მართვის მოწყობილობები და პანიკის ღილაკები",
  "სირენები",
  "ინტეგრაციის მოდულები",
  "ავტომატიზაცია",
  "კვების ბლოკები",
  "ხანძრის დეტექტორები",
  "ხანძრის დეტექტორები EN54",
  "წყლის გაჟონვის დეტექტორები",
  "ელექტრო ონკანები",
  "ჭკვიანი ჩამრთველები (LightSwitch)",
  "ჰაერის ხარისხის დეტექტორები",
  "ჭკვიანი როზეტები",
];

const COLUMNS = { sku: 0, name: 1, cost: 2, description: 3 };

const dahua = {
  sheets: {
    Fire: {
      brand: "Dahua",
      category: [SEC, "სახანძრო სიგნალიზაცია", "მისამართიანი სახანძრო სიგნალიზაცია"],
      skipRows: 1,
      columns: COLUMNS,
      currency: "USD",
      preorder: true,
    },
    Wireless: {
      brand: "Dahua",
      category: [SEC, "დაცვითი სიგნალიზაცია", "უსადენო სიგნალიზაცია"],
      skipRows: 1,
      columns: COLUMNS,
      currency: "USD",
      preorder: true,
    },
    Voice: {
      brand: "Dahua",
      category: [SEC],
      skipRows: 1,
      columns: COLUMNS,
      sectionRows: true, // „მეხანძრის ტელეფონია“ / „საჯარო მაუწყებლობა…“ → ქვეკატეგორია
      currency: "USD",
      preorder: true,
    },
  },
};

const ajax = {
  sheets: {
    Ajax: {
      brand: "Ajax",
      category: [SEC, "დაცვითი სიგნალიზაცია"],
      skipRows: 1,
      columns: COLUMNS,
      sectionRows: true, // პანელები, დეტექტორები, სირენები… → ქვეკატეგორიები
      currency: "USD",
      preorder: true,
    },
  },
};

const COMMON = {
  adapter: "SPREADSHEET",
  authType: "NONE",
  retailBase: "COST",
  markupRetail: 0, // ფასდადება არ ედება — ნუსხის ფასი ისეა
  markupDealer: 0,
  syncEveryMin: 60, // კურსი დღიურად იცვლება, საათობრივი შემოწმება საკმარისია
  isActive: true,
};

(async () => {
  await ensureTree([SEC, "სახანძრო სიგნალიზაცია", "მისამართიანი სახანძრო სიგნალიზაცია"]);
  await ensureTree([SEC, ALARM, "უსადენო სიგნალიზაცია"]);
  await ensureTree([SEC, "მეხანძრის ტელეფონია"]);
  await ensureTree([SEC, "საჯარო მაუწყებლობის და ევაკუაციის სისტემა"]);
  for (const s of AJAX_SECTIONS) await ensureTree([SEC, ALARM, s]);

  for (const [slug, name, map] of [
    ["dahua", "Dahua (PDF ნუსხა, USD)", dahua],
    ["ajax", "Ajax Systems (PDF ნუსხა, USD)", ajax],
  ] as const) {
    const fieldMap = JSON.stringify(map, null, 2);
    const s = await db.supplier.upsert({
      where: { slug },
      create: { slug, name, fieldMap, ...COMMON },
      update: { name, fieldMap, ...COMMON },
    });
    console.log(`✓ ${s.slug} — ${s.name}`);
  }
  await db.$disconnect();
})();
