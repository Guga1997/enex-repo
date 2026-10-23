/**
 * „დაცვითი სიგნალიზაცია“ ხუთ სეგმენტად და ქვეჯგუფების გადატანა:
 * სვიჩები და მყარი დისკები → ვიდეო-მეთვალყურეობა, ელსადგურის აქსესუარები →
 * პორტატული ელსადგურები, საკეტების აქსესუარები → ელექტრონული საკეტები.
 *
 *   npx tsx scripts/restructure-categories.ts          — ნახვა: რომელი პროდუქტი სად გადადის
 *   npx tsx scripts/restructure-categories.ts --write  — გადატანა
 *
 * 18 ქვეკატეგორია იყო (მოძრაობის, გაღების, ხანძრის… დეტექტორები ცალ-ცალკე,
 * „უსადენო სიგნალიზაცია“ — ყველაფერი ერთად). რჩება ხუთი:
 *   საკონტროლო პანელები · დეტექტორები · მართვის მოწყობილობები · სირენები · ავტომატიზაცია
 * შერეულ კატეგორიებში პროდუქტი სახელით ნაწილდება; დაცლილი კატეგორია იშლება.
 * გამეორება უსაფრთხოა.
 */
import { db } from "../src/lib/db";

const WRITE = process.argv.includes("--write");

type Seg = { key: string; nameKa: string; nameEn: string; nameRu: string; slug: string };
const SEGMENTS: Seg[] = [
  { key: "panels", nameKa: "საკონტროლო პანელები", nameEn: "Control panels", nameRu: "Контрольные панели", slug: "sakontrolo-panelebi" },
  { key: "detectors", nameKa: "დეტექტორები", nameEn: "Detectors", nameRu: "Датчики", slug: "deteqtorebi" },
  { key: "control", nameKa: "მართვის მოწყობილობები", nameEn: "Control devices", nameRu: "Устройства управления", slug: "martvis-mowyobilobebi" },
  { key: "sirens", nameKa: "სირენები", nameEn: "Sirens", nameRu: "Сирены", slug: "sirenebi" },
  { key: "automation", nameKa: "ავტომატიზაცია", nameEn: "Automation", nameRu: "Автоматизация", slug: "avtomatizatsia" },
];

/** ძველი კატეგორია → სეგმენტი. null — შერეულია, სახელით ნაწილდება */
const FROM: Record<string, string | null> = {
  "საკონტროლო პანელები": "panels",
  "სიგნალის გამაძლიერებლები": "panels",
  "ინტეგრაციის მოდულები": null,
  "მოძრაობის დეტექტორები": "detectors",
  "გაღების დეტექტორები": "detectors",
  "მინის მსხვრევის დეტექტორები": "detectors",
  "წყლის გაჟონვის დეტექტორები": "detectors",
  "ხანძრის დეტექტორები": "detectors",
  "ჰაერის ხარისხის დეტექტორები": "detectors",
  "ხანძრის დეტექტორები EN54": null,
  "მართვის მოწყობილობები და პანიკის ღილაკები": "control",
  "სირენები": "sirens",
  "ავტომატიზაცია": "automation",
  "ელექტრო ონკანები": "automation",
  "ჭკვიანი როზეტები": "automation",
  "ჭკვიანი ჩამრთველები (LightSwitch)": "automation",
  "უსადენო სიგნალიზაცია": null,
  "დაცვითი სიგნალიზაცია": null, // პირდაპირ მშობელში მდგარი
};

/** შერეულისთვის — პირველი დამთხვევა. რიგი მნიშვნელოვანია: „CO დეტექტორი სირენით“ დეტექტორია */
const BY_NAME: [RegExp, string][] = [
  [/დეტექტ|სამაგრი|კონტაქტური|მაგნიტური კონტაქტი|კრონშტეინი|სენსორი|ლუქსი|იმუნიტეტი|PIR|მიკროტალღ/i, "detectors"],
  [/სირენა|განგაშის მოწყობილობა/i, "sirens"],
  [/პულტი|ღილაკი|კლავიატურ|მართვის უსადენო პანელი|აყვანა\/მოხსნა/i, "control"],
  [/რელე|ჩამრთველი/i, "automation"],
  [/ჰაბი|hub|გამაძლიერებელი|გამაფართოვებელი|მონიტორინგის კონტაქტი|კუმულატორი|გადამცემი|ავტოდამრეკი|მოდული|bridge|casing|panel|პანელი|glandbox/i, "panels"],
];

function classify(from: string, name: string): string | null {
  if (FROM[from]) return FROM[from];
  // ინტეგრაციის მოდული პანელის გაფართოებაა — „სხვა დეტექტორის მისაერთებელი“ დეტექტორი არ არის
  if (from === "ინტეგრაციის მოდულები") {
    if (/ღილაკ/i.test(name)) return "control";
    if (/რელე|ჩამრთველ/i.test(name)) return "automation";
    return "panels";
  }
  return BY_NAME.find(([re]) => re.test(name))?.[1] ?? null;
}

(async () => {
  const parent = await db.category.findFirstOrThrow({ where: { nameKa: "დაცვითი სიგნალიზაცია" } });
  const subs = await db.category.findMany({
    where: { parentId: parent.id },
    select: { id: true, nameKa: true, slug: true, _count: { select: { children: true } } },
  });
  const all = [{ id: parent.id, nameKa: parent.nameKa, slug: parent.slug, _count: { children: 0 } }, ...subs];
  const unknown = subs.filter((c) => !(c.nameKa in FROM) && !SEGMENTS.some((s) => s.nameKa === c.nameKa));
  if (unknown.length) throw new Error(`უცნობი ქვეკატეგორია: ${unknown.map((c) => c.nameKa).join(", ")}`);

  const products = await db.product.findMany({
    where: { categoryId: { in: all.map((c) => c.id) } },
    select: { id: true, sku: true, nameKa: true, categoryId: true },
    orderBy: { nameKa: "asc" },
  });
  const catName = new Map(all.map((c) => [c.id, c.nameKa]));

  const plan = new Map<string, { id: string; sku: string; name: string; from: string }[]>();
  const stay: string[] = [];
  for (const p of products) {
    const from = catName.get(p.categoryId)!;
    // უკვე სეგმენტში მდგარი (მეორე გაშვება) — თავის ადგილას რჩება
    const to = SEGMENTS.find((s) => s.nameKa === from)?.key ?? classify(from, p.nameKa);
    if (!to) { stay.push(`${p.sku}  ${p.nameKa.slice(0, 70)}  (${from})`); continue; }
    plan.set(to, [...(plan.get(to) ?? []), { id: p.id, sku: p.sku, name: p.nameKa, from }]);
  }

  for (const s of SEGMENTS) {
    const list = plan.get(s.key) ?? [];
    console.log(`\n=== ${s.nameKa} — ${list.length}`);
    for (const p of list) console.log(`  ${p.sku.padEnd(26)} ${p.name.slice(0, 70).padEnd(71)} ← ${p.from}`);
  }
  if (stay.length) {
    console.log(`\n=== რჩება „დაცვითი სიგნალიზაცია“-ში — ${stay.length}`);
    for (const l of stay) console.log("  " + l);
  }

  // ქვეჯგუფის გადატანა სხვა ქვეჯგუფში — პროდუქტები თან მიჰყვება
  const MOVES: [string, string][] = [
    ["svichebi", "video-metvalyureoba"],
    ["myari-diskebi", "video-metvalyureoba"],
    ["portatuli-elsadguris-aqsesuarebi", "portatuli-elsadgurebi"],
    ["saketebis-aqsesuarebi", "eleqtronuli-saketebi"],
  ];
  const moves: { id: string; to: string; label: string; done: boolean }[] = [];
  for (const [slug, toSlug] of MOVES) {
    const c = await db.category.findUnique({ where: { slug }, include: { parent: true } });
    const to = await db.category.findUnique({ where: { slug: toSlug } });
    if (!c || !to) { console.log(`\n⚠ ${slug} → ${toSlug}: ვერ მოიძებნა`); continue; }
    const done = c.parentId === to.id;
    moves.push({ id: c.id, to: to.id, label: `${c.nameKa}: ${c.parent?.nameKa} → ${to.nameKa}`, done });
    console.log(`\n${done ? "✓ უკვე" : "→"} ${c.nameKa}: ${c.parent?.nameKa} → ${to.nameKa}`);
  }

  if (!WRITE) {
    console.log("\nცვლილება არ შესულა. გასაშვებად: --write");
    await db.$disconnect();
    return;
  }

  // სეგმენტები: არსებული ადგილზე რჩება (id და პროდუქტები), ახალი იქმნება
  const segId = new Map<string, string>();
  for (const [i, s] of SEGMENTS.entries()) {
    const existing =
      subs.find((c) => c.nameKa === s.nameKa) ??
      (s.key === "control" ? subs.find((c) => c.nameKa === "მართვის მოწყობილობები და პანიკის ღილაკები") : undefined);
    const data = { nameKa: s.nameKa, nameEn: s.nameEn, nameRu: s.nameRu, slug: s.slug, sortOrder: i, parentId: parent.id, isActive: true };
    const c = existing
      ? await db.category.update({ where: { id: existing.id }, data })
      : await db.category.create({ data });
    segId.set(s.key, c.id);
  }

  let moved = 0;
  for (const [key, list] of plan) {
    const r = await db.product.updateMany({
      where: { id: { in: list.map((p) => p.id) } },
      data: { categoryId: segId.get(key)! },
    });
    moved += r.count;
  }

  // დაცლილი ძველი ქვეკატეგორიები
  const keep = new Set(segId.values());
  const old = await db.category.findMany({
    where: { parentId: parent.id, id: { notIn: [...keep] } },
    select: { id: true, nameKa: true, _count: { select: { products: true, children: true, pricingRules: true } } },
  });
  const removable = old.filter((c) => !c._count.products && !c._count.children && !c._count.pricingRules);
  await db.category.deleteMany({ where: { id: { in: removable.map((c) => c.id) } } });

  await db.category.update({
    where: { id: parent.id },
    data: { nameEn: parent.nameEn ?? "Security alarm", nameRu: parent.nameRu ?? "Охранная сигнализация" },
  });

  for (const m of moves.filter((m) => !m.done)) {
    const last = await db.category.aggregate({ where: { parentId: m.to }, _max: { sortOrder: true } });
    await db.category.update({
      where: { id: m.id },
      data: { parentId: m.to, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    });
  }

  // Dahua-ს ნუსხის ხელახალი იმპორტი ძველ „უსადენო სიგნალიზაციას“ აღარ ეძებს
  const dahua = await db.supplier.findUnique({ where: { slug: "dahua" }, select: { id: true, fieldMap: true } });
  if (dahua?.fieldMap) {
    const map = JSON.parse(dahua.fieldMap);
    const wireless = map.sheets?.Wireless;
    if (wireless) {
      const base = ["უსაფრთხოების სისტემები", "დაცვითი სიგნალიზაცია"];
      const seg = (k: string) => [...base, SEGMENTS.find((s) => s.key === k)!.nameKa];
      wireless.category = base;
      wireless.rules = [
        ...["დეტექტ", "სამაგრი", "კონტაქტური", "ლუქსი", "იმუნიტეტი"].map((c) => ({ contains: c, category: seg("detectors") })),
        { contains: "სირენა", category: seg("sirens") },
        ...["პულტი", "ღილაკი", "მართვის უსადენო პანელი", "აყვანა/მოხსნა"].map((c) => ({ contains: c, category: seg("control") })),
        ...["ჰაბი", "გამაძლიერებელი", "მონიტორინგის კონტაქტი", "კუმულატორი"].map((c) => ({ contains: c, category: seg("panels") })),
      ];
      await db.supplier.update({ where: { id: dahua.id }, data: { fieldMap: JSON.stringify(map, null, 2) } });
    }
  }

  console.log(`\n✓ გადავიდა ${moved} პროდუქტი; წაიშალა ${removable.length} ცარიელი კატეგორია: ${removable.map((c) => c.nameKa).join(", ")}`);
  const left = old.filter((c) => !removable.includes(c));
  if (left.length) console.log(`  დარჩა (პროდუქტი/წესი აქვს): ${left.map((c) => c.nameKa).join(", ")}`);
  await db.$disconnect();
})();
