import { PrismaClient } from "@prisma/client";
import { TAXONOMY, type Node } from "./taxonomy";

const db = new PrismaClient();

const KA_LAT: Record<string, string> = {
  ა:"a",ბ:"b",გ:"g",დ:"d",ე:"e",ვ:"v",ზ:"z",თ:"t",ი:"i",კ:"k",ლ:"l",მ:"m",ნ:"n",
  ო:"o",პ:"p",ჟ:"zh",რ:"r",ს:"s",ტ:"t",უ:"u",ფ:"f",ქ:"q",ღ:"gh",ყ:"y",შ:"sh",
  ჩ:"ch",ც:"c",ძ:"dz",წ:"w",ჭ:"tch",ხ:"kh",ჯ:"j",ჰ:"h",
};

function slugify(name: string): string {
  const s = [...name.toLowerCase()]
    .map((ch) => KA_LAT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "cat";
}

/** slug გლობალურად უნიკალურია — გამეორებულს მშობლის პრეფიქსს ვაწერთ, შემდეგ ნომერს */
function uniqueSlug(name: string, parentSlug: string | null, taken: Set<string>): string {
  const base = slugify(name);
  const candidates = [base, parentSlug ? `${parentSlug}-${base}` : ""].filter(Boolean);
  for (const c of candidates) if (!taken.has(c)) { taken.add(c); return c; }
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  taken.add(`${base}-${i}`);
  return `${base}-${i}`;
}

/** ძველი დემო-ქვეკატეგორია → ახალი ფოთოლი, რომ 27 პროდუქტი უადგილოდ არ დარჩეს */
const REMAP: Record<string, string> = {
  "ვიდეო-მეთვალყურეობა": "IP კამერები",
  "დაშვების სისტემა და დომოფონები": "დაშვების სისტემა",
  "სახანძრო სიგნალიზაცია": "არამისამართიანი სახანძრო სიგნალიზაცია",
  "მყარი დისკები": "მყარი დისკები (შენახვა)",
  "სვიჩები": "მართვადი სვიჩები",
  "როუტერები": "ეზერნეტ როუტერები",
  "WiFi წვდომის წერტილები": "დაშვების წერტილები Access Points",
  "კვების ბლოკები": "ინდუსტრიული კვების ბლოკები",
  "უწყვეტი კვების წყარო (UPS)": "On-Line UPS",
  "ინვერტორები": "On-Grid ინვერტორები",
};

async function main() {
  const taken = new Set((await db.category.findMany({ select: { slug: true } })).map((c) => c.slug));
  const idByName = new Map<string, string>();
  let created = 0;

  async function walk(nodes: Node[], parentId: string | null, parentSlug: string | null, depth: number) {
    let order = 0;
    for (const node of nodes) {
      const existing = await db.category.findFirst({ where: { nameKa: node.name } });
      const slug = existing?.slug ?? uniqueSlug(node.name, parentSlug, taken);
      const cat = existing
        ? await db.category.update({
            where: { id: existing.id },
            data: { parentId, sortOrder: order, isActive: true },
          })
        : await db.category.create({
            data: { slug, nameKa: node.name, parentId, sortOrder: order, isActive: true },
          });
      if (!existing) created++;
      idByName.set(node.name, cat.id);
      order++;
      if (node.children?.length) await walk(node.children, cat.id, slug, depth + 1);
    }
  }

  await walk(TAXONOMY, null, null, 1);

  // დემო-პროდუქტების გადატანა ახალ ფოთლებზე
  let moved = 0;
  for (const [oldName, newName] of Object.entries(REMAP)) {
    const target = idByName.get(newName);
    const source = await db.category.findFirst({ where: { nameKa: oldName } });
    if (!target || !source || source.id === target) continue;
    const res = await db.product.updateMany({ where: { categoryId: source.id }, data: { categoryId: target } });
    moved += res.count;
  }

  // ხეში აღარმყოფი, ცარიელი კატეგორიების მოშორება
  const keep = new Set(idByName.values());
  const stale = await db.category.findMany({
    where: { id: { notIn: [...keep] } },
    include: { _count: { select: { products: true, children: true } } },
  });
  let removed = 0;
  for (const c of stale) {
    if (c._count.products === 0 && c._count.children === 0) {
      await db.category.delete({ where: { id: c.id } });
      removed++;
    }
  }

  const total = await db.category.count();
  console.log(`კატეგორია: სულ ${total} (ახალი ${created}), პროდუქტი გადატანილია ${moved}, წაშლილია ${removed}`);
}

main().finally(() => db.$disconnect());
