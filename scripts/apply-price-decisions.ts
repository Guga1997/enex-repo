/**
 * ფასების აუდიტის ხუთი გადაწყვეტილება (მფლობელმა დაადასტურა 2026-11-13).
 *
 *   npx tsx scripts/apply-price-decisions.ts          — ნახვა (არაფერს ცვლის)
 *   npx tsx scripts/apply-price-decisions.ts --apply  — ჩაწერა
 *
 * 1. Bluetti — 3 პოზიცია ფაილიდან, რომელიც MUK-ის API-ში არ არის: ითიშება.
 * 2. Delta   — ფაილიდან შემოტანილი „…/GE“ დუბლიკატები (MUK-ის ორეულით): იშლება.
 * 3. MUK     — პოზიციები, სადაც MUK-ის საცალო მის სადილეროზე დაბალია: ჩვენი ფასი = MUK-ის
 *              საცალო, ჩაკეტილი (თორემ სინქი თვითღირებულებაზე დააბრუნებს).
 * 4. Ajax    — ფასთა ნუსხა (USD) ისევ მიმწოდებლად: ლარის ფასი ეროვნული ბანკის კურსს მიჰყვება.
 * 5. Intellcom — პოზიციები, რომელთაც Intellcom საცალოს არ აწვდის: „ფასი მოთხოვნით“ (0, ჩაკეტილი).
 *
 * ფასდაკლებულ პროდუქტს (oldPrice) არცერთი ნაბიჯი არ ეხება. ყოველი ნაბიჯი ამოწმებს, რომ
 * მდგომარეობა ისევ ისაა, რაც დადასტურებისას იყო; თუ არა — გამოტოვებს და წერს, რატომ.
 * ხელახლა გაშვება უსაფრთხოა.
 */
import { db } from "../src/lib/db";
import { syncSupplier } from "../src/lib/suppliers";

const APPLY = process.argv.includes("--apply");
const say = (s: string) => console.log(s);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** 1 */
const BLUETTI = ["B500/GE", "B700", "EP2000"];

/** 2 — კოდი „/GE“-ს გარეშე MUK-ის პროდუქტია */
const DELTA_DUPS = [
  "3313489100-S35/GE", "BBU161B107035/GE", "BBU201B109035/GE", "PDU1315A2810001/GE", "PDU5315A2800000/GE",
  "SCMS100035/GE", "UPS103R2RT2N035/GE", "UPS153R6RT2N035/GE", "UPS203R6RT2N035/GE", "UPS403HH330N035/GE",
  "UPS602R2RT2N035/GE",
];

/**
 * 3 — MUK-ის საცალო < MUK-ის სადილერო. „210-BPSQ“ (Dell Pro Max Tower: საცალო 6 488.88,
 * სადილერო 10 087.91 — 36%-ით დაბლა) სიაში არ არის: ეს MUK-ის მონაცემის შეცდომას ჰგავს და
 * ცალკე დადასტურებას ელოდება.
 */
const MUK_RETAIL = [
  "14207-72", "210-BQWL", "210-BQWM", "2383-820-109", "2699-820-109", "482-BBCY",
  "FC-10-F100F-950-02-12", "GRP2611G", "NP65-12/G",
];
/** დაცვა: სიაში მყოფი პოზიციაც არ ჩაიწერება, თუ საცალო თვითღირებულებაზე ამაზე მეტით დაბლაა */
const MUK_MAX_BELOW_COST = 0.15;

/** 5 — მხოლოდ Intellcom-ის პოზიციები საცალოს გარეშე, რომლებიც ახლა ფასით ჩანს */
const INTELLCOM_ON_REQUEST = ["00541", "01279", "01311", "01474", "02241", "02369", "02284", "02285", "03569"];

/** 4 — იგივე აღწერა, რაც scripts/seed-security-suppliers.ts-ში */
const AJAX = {
  slug: "ajax",
  name: "Ajax Systems (PDF ნუსხა, USD)",
  adapter: "SPREADSHEET",
  authType: "NONE",
  retailBase: "COST",
  markupRetail: 0, // ფასდადება არ ედება — ნუსხის ფასი ისეა
  markupDealer: 0,
  syncEveryMin: 60,
  isActive: true,
  fieldMap: JSON.stringify(
    {
      sheets: {
        Ajax: {
          brand: "Ajax",
          category: ["უსაფრთხოების სისტემები", "დაცვითი სიგნალიზაცია"],
          skipRows: 1,
          columns: { sku: 0, name: 1, cost: 2, description: 3 },
          sectionRows: true,
          currency: "USD",
          preorder: true,
        },
      },
    },
    null,
    2
  ),
};

async function bluetti() {
  say("\n== 1. Bluetti — გათიშვა");
  for (const sku of BLUETTI) {
    const p = await db.product.findUnique({
      where: { sku },
      select: { id: true, isActive: true, price: true, oldPrice: true, _count: { select: { supplies: true } } },
    });
    if (!p) { say(`  – ${sku}: ვერ ვიპოვე`); continue; }
    if (p.oldPrice !== null) { say(`  – ${sku}: ფასდაკლებულია — არ ვეხები`); continue; }
    if (p._count.supplies > 0) { say(`  – ${sku}: უკვე მიმწოდებელს უკავშირდება — არ ვეხები`); continue; }
    if (!p.isActive) { say(`  ✓ ${sku}: უკვე გათიშულია`); continue; }
    say(`  ✕ ${sku}: ${p.price} ₾ → გათიშული`);
    if (APPLY) await db.product.update({ where: { id: p.id }, data: { isActive: false } });
  }
}

async function delta() {
  say("\n== 2. Delta — დუბლიკატების წაშლა");
  for (const sku of DELTA_DUPS) {
    const p = await db.product.findUnique({
      where: { sku },
      select: {
        id: true, isActive: true, price: true, oldPrice: true,
        _count: { select: { supplies: true, orderItems: true, favorites: true } },
      },
    });
    if (!p) { say(`  ✓ ${sku}: უკვე წაშლილია`); continue; }
    const twin = await db.product.findUnique({
      where: { sku: sku.replace(/\/GE$/, "") },
      select: { sku: true, price: true, isActive: true, supplies: { select: { supplier: { select: { slug: true } } } } },
    });
    const why =
      p.oldPrice !== null ? "ფასდაკლებულია"
      : p.isActive ? "ჩართულია"
      : p._count.supplies > 0 ? "მიმწოდებელს უკავშირდება"
      : p._count.orderItems > 0 ? "შეკვეთაშია"
      : p._count.favorites > 0 ? "ვიღაცის რჩეულებშია"
      : !twin || !twin.isActive || !twin.supplies.some((s) => s.supplier.slug === "muk") ? "MUK-ის ჩართული ორეული არ აქვს"
      : null;
    if (why) { say(`  – ${sku}: ${why} — არ ვშლი`); continue; }
    say(`  ✕ ${sku}: ${p.price} ₾ იშლება; რჩება ${twin!.sku} — ${twin!.price} ₾ (MUK)`);
    if (APPLY) await db.product.delete({ where: { id: p.id } });
  }
}

async function mukRetail() {
  say("\n== 3. MUK — საცალო ფასი (სადილეროზე დაბალი)");
  const muk = await db.supplier.findUnique({ where: { slug: "muk" }, select: { id: true } });
  if (!muk) { say("  – MUK მიმწოდებელი ვერ ვიპოვე"); return; }
  for (const sku of MUK_RETAIL) {
    const p = await db.product.findUnique({
      where: { sku },
      select: {
        id: true, price: true, oldPrice: true, priceLocked: true,
        supplies: { select: { supplierId: true, cost: true, listPrice: true, qty: true } },
      },
    });
    if (!p) { say(`  – ${sku}: ვერ ვიპოვე`); continue; }
    const s = p.supplies.find((x) => x.supplierId === muk.id);
    const list = s?.listPrice ?? 0, cost = s?.cost ?? 0;
    const why =
      p.oldPrice !== null ? "ფასდაკლებულია"
      : p.supplies.length !== 1 || !s ? "მხოლოდ MUK-ის პროდუქტი აღარ არის"
      : !(list > 0) ? "MUK საცალოს აღარ აწვდის"
      : list >= cost ? `MUK-ის საცალო (${list}) უკვე აღარ არის სადილეროზე (${cost}) დაბალი — სინქი თვითონ სწორად აფასებს`
      : list < cost * (1 - MUK_MAX_BELOW_COST) ? `საცალო ${list} თვითღირებულებაზე (${cost}) ${Math.round((1 - list / cost) * 100)}%-ით დაბალია — ზედმეტად დიდი სხვაობა`
      : null;
    if (why) { say(`  – ${sku}: ${why} — არ ვეხები`); continue; }
    const price = round2(list);
    if (p.priceLocked && p.price === price) { say(`  ✓ ${sku}: უკვე ${price} ₾ (ჩაკეტილი)`); continue; }
    say(`  ✕ ${sku}: ${p.price} → ${price} ₾ (თვითღირებულება ${cost}; ზარალი ცალზე ${round2(cost - price)} ₾; მარაგი ${s!.qty})`);
    if (APPLY) await db.product.update({ where: { id: p.id }, data: { price, priceLocked: true } });
  }
}

async function ajax() {
  say("\n== 4. Ajax — ფასთა ნუსხა მიმწოდებლად");
  const before = await db.product.findMany({
    where: { sku: { startsWith: "AJAX-" } },
    select: { sku: true, price: true, oldPrice: true, priceLocked: true },
  });
  say(`  პროდუქტი: ${before.length}; ფასდაკლებული: ${before.filter((p) => p.oldPrice !== null).length}; ჩაკეტილი: ${before.filter((p) => p.priceLocked).length}`);
  let supplier = await db.supplier.findUnique({ where: { slug: AJAX.slug }, select: { id: true } });
  if (supplier) say("  ✓ მიმწოდებელი უკვე არსებობს — პარამეტრებს არ ვცვლი");
  else say("  ✕ იქმნება მიმწოდებელი „ajax“ (USD ნუსხა, ფასდადება 0%, სინქი საათში ერთხელ)");
  if (!APPLY) { say("  (სინქი და ფასების გადათვლა მხოლოდ --apply-ზე)"); return; }

  if (!supplier) supplier = await db.supplier.create({ data: AJAX, select: { id: true } });
  // ფასდაკლებულს სინქი ფასს შეუცვლიდა — ჩაკეტვით ვიცავთ (ამჟამად ასეთი არ არის)
  const promo = before.filter((p) => p.oldPrice !== null && !p.priceLocked).map((p) => p.sku);
  if (promo.length) await db.product.updateMany({ where: { sku: { in: promo } }, data: { priceLocked: true } });

  const r = await syncSupplier(supplier.id);
  say(`  სინქი: ${r.ok ? "OK" : "შეცდომა"} — ახალი ${r.created}, განახლდა ${r.updated}, ჩავარდა ${r.failed}${r.message ? " — " + r.message : ""}`);
  const after = new Map(
    (await db.product.findMany({ where: { sku: { startsWith: "AJAX-" } }, select: { sku: true, price: true } })).map((p) => [p.sku, p.price])
  );
  const changed = before.filter((p) => after.get(p.sku) !== p.price);
  say(`  ფასი შეიცვალა: ${changed.length} / ${before.length}`);
  for (const p of changed.slice(0, 5)) say(`    ${p.sku}: ${p.price} → ${after.get(p.sku)} ₾`);
  const linked = await db.productSupply.count({ where: { supplierId: supplier.id } });
  say(`  ნუსხასთან დაკავშირებული: ${linked}`);
}

async function intellcom() {
  say("\n== 5. Intellcom — საცალოს გარეშე → „ფასი მოთხოვნით“");
  const ic = await db.supplier.findUnique({ where: { slug: "intellcom" }, select: { id: true } });
  if (!ic) { say("  – Intellcom მიმწოდებელი ვერ ვიპოვე"); return; }
  for (const sku of INTELLCOM_ON_REQUEST) {
    const p = await db.product.findUnique({
      where: { sku },
      select: {
        id: true, nameKa: true, price: true, oldPrice: true, priceLocked: true,
        supplies: { select: { supplierId: true, cost: true, listPrice: true } },
      },
    });
    if (!p) { say(`  – ${sku}: ვერ ვიპოვე`); continue; }
    const s = p.supplies.find((x) => x.supplierId === ic.id);
    const why =
      p.oldPrice !== null ? "ფასდაკლებულია"
      : p.supplies.length !== 1 || !s ? "მხოლოდ Intellcom-ის პროდუქტი აღარ არის"
      : (s.listPrice ?? 0) > 0 ? `Intellcom უკვე აწვდის საცალოს (${s.listPrice}) — სინქი თვითონ აფასებს`
      : null;
    if (why) { say(`  – ${sku}: ${why} — არ ვეხები`); continue; }
    if (p.price === 0 && p.priceLocked) { say(`  ✓ ${sku}: უკვე „ფასი მოთხოვნით“`); continue; }
    say(`  ✕ ${sku}: ${p.price} ₾ → ფასი მოთხოვნით   ${p.nameKa.slice(0, 50)}`);
    if (APPLY) await db.product.update({ where: { id: p.id }, data: { price: 0, dealerPrice: null, priceLocked: true } });
  }
}

(async () => {
  say(APPLY ? "რეჟიმი: ჩაწერა" : "რეჟიმი: ნახვა (არაფერი იცვლება) — ჩასაწერად --apply");
  await bluetti();
  await delta();
  await mukRetail();
  await ajax();
  await intellcom();
  await db.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
