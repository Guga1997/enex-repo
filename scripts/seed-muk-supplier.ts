/**
 * MUK-ის მიმწოდებლად დამატება.
 *   MUK_URL="https://api.muk.ge/<გასაღები>/XML/PRICE" npx tsx scripts/seed-muk-supplier.ts
 *
 * იდემპოტენტურია: არსებულს მისამართსა და კატეგორიების რუკას აახლებს,
 * ფასნამატს კი ხელუხლებელს ტოვებს (ადმინში შეიძლება უკვე შეცვლილი იყოს).
 */
import { db } from "../src/lib/db";

const URL_ENV = process.env.MUK_URL;

/** MUK-ის ინგლისური კატეგორიები → ჩვენი ხე. „CATEGORY/KOD2“ უპირატესია. */
const CATEGORIES: Record<string, string[]> = {
  "Network equipment/Switch": ["LAN & WAN", "სვიჩები (LAN)"],
  "Network equipment/Access point": ["LAN & WAN", "კორპორატიული WiFi", "დაშვების წერტილები Access Points"],
  "Network equipment/Router": ["LAN & WAN", "როუტერები და Firewall-ები"],
  "Network equipment/Security": ["LAN & WAN", "როუტერები და Firewall-ები"],
  "Network equipment/Transciever Module": ["ოპტიკური ქსელი", "SFP მოდულები"],
  "Network equipment/Phone": ["აუდიო-ვიდეო", "VoIP", "IP ტელეფონები"],
  "Network equipment/PBX": ["აუდიო-ვიდეო", "VoIP", "სატელეფონო სადგურები და კარიბჭეები"],
  "Network equipment/Gateway": ["აუდიო-ვიდეო", "VoIP", "სატელეფონო სადგურები და კარიბჭეები"],
  UPS: ["ენერგო უზრუნველყოფა", "უწყვეტი კვების წყაროები UPS"],
  Monitor: ["აუდიო-ვიდეო", "მონიტორები"],
  "Rack cabinet and accessories": ["LAN & WAN", "საკომუნიკაციო კარადები"],
  "Storage system": ["მონაცემთა შენახვა"],
  Server: ["მონაცემთა შენახვა"],
};

(async () => {
  const existing = await db.supplier.findUnique({ where: { slug: "muk" } });
  const fieldMap = JSON.stringify({ categories: CATEGORIES }, null, 1);
  const baseUrl = URL_ENV ?? existing?.baseUrl ?? null;

  if (!baseUrl) {
    console.log("MUK_URL არ არის მითითებული და ბაზაშიც არ ინახება — მისამართის გარეშე ვერ შევქმნი");
    await db.$disconnect();
    return;
  }

  const supplier = await db.supplier.upsert({
    where: { slug: "muk" },
    create: {
      slug: "muk",
      name: "MUK",
      adapter: "MUK",
      baseUrl,
      authType: "NONE", // გასაღები მისამართის ნაწილია
      fieldMap,
      retailBase: "COST",
      markupRetail: 30,
      markupDealer: 15,
      syncEveryMin: 60,
      isActive: true,
    },
    update: { adapter: "MUK", baseUrl, fieldMap },
  });

  console.log(`✓ ${supplier.name} (${supplier.slug})`);
  console.log(`  ადაპტერი: ${supplier.adapter}, სინქი ყოველ ${supplier.syncEveryMin} წუთში`);
  console.log(`  ფასნამატი: საცალო +${supplier.markupRetail}%, სადილერო +${supplier.markupDealer}% (თვითღირებულებაზე)`);
  console.log(`  კატეგორიის რუკა: ${Object.keys(CATEGORIES).length} ჩანაწერი`);
  await db.$disconnect();
})();
