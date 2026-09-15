/**
 * საწყისი მონაცემები — ადმინი, კატეგორიების ხე, ბრენდები და სადემონსტრაციო
 * პროდუქტები. გაშვება:  npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const ADMIN_EMAIL = "admin@example.ge";
const ADMIN_PASSWORD = "admin12345";

const CATEGORIES: { name: string; slug: string; children: [string, string][] }[] = [
  {
    name: "უსაფრთხოების სისტემები",
    slug: "usaprtkhoebis-sistemebi",
    children: [
      ["ვიდეო-მეთვალყურეობა", "video-metvalyureoba"],
      ["დაშვების სისტემა და დომოფონები", "dashvebis-sistema"],
      ["სახანძრო სიგნალიზაცია", "sakhandzro-signalizacia"],
      ["მყარი დისკები", "myari-diskebi"],
    ],
  },
  {
    name: "ქსელური მოწყობილობები",
    slug: "qseluri-mowyobilobebi",
    children: [
      ["სვიჩები", "svichebi"],
      ["როუტერები", "routerebi"],
      ["WiFi წვდომის წერტილები", "wifi-access-point"],
    ],
  },
  {
    name: "ენერგო უზრუნველყოფა",
    slug: "energo-uzrunvelyofa",
    children: [
      ["კვების ბლოკები", "kvebis-blokebi"],
      ["უწყვეტი კვების წყარო (UPS)", "ups"],
      ["ინვერტორები", "invertorebi"],
    ],
  },
];

type SeedProduct = {
  sku: string;
  name: string;
  model: string;
  category: string;
  brand: string;
  price: number;
  oldPrice?: number;
  qty: number;
  status?: "IN_STOCK" | "OUT_OF_STOCK" | "IN_TRANSIT" | "PREORDER";
  incomingDate?: string;
  isNew?: boolean;
  attrs: [string, string][];
};

const PRODUCTS: SeedProduct[] = [
  {
    sku: "03904", name: "IP კამერა - 4მპ, 2.8მმ, Dome, Mic, SD, ANR, IK10, Uniview",
    model: "IPC3634SE-ADF28KMC-WP-I1", category: "video-metvalyureoba", brand: "Uniview",
    price: 729, qty: 14, isNew: true,
    attrs: [["რეზოლუცია", "4მპ"], ["ობიექტივი", "2.8მმ"], ["კორპუსი", "Dome"], ["IR მანძილი", "30მ"], ["მიკროფონი", "დიახ"]],
  },
  {
    sku: "03527", name: "IP კამერა - 4მპ, Dome, PTZ, 16x, SD, ANR, IK10, IR100, LightHunter, Uniview",
    model: "IPC6434LR-X16-VG1", category: "video-metvalyureoba", brand: "Uniview",
    price: 1239.3, qty: 5,
    attrs: [["რეზოლუცია", "4მპ"], ["კორპუსი", "PTZ"], ["ოპტიკური zoom", "16x"], ["IR მანძილი", "100მ"]],
  },
  {
    sku: "03662", name: "IP კამერა - 4მპ, 2.8მმ, Bullet, Mic, Speaker, SD, ANR, IK10, Uniview",
    model: "IPC2B14SE-ADF28KMC-WP-I1", category: "video-metvalyureoba", brand: "Uniview",
    price: 656.1, qty: 22,
    attrs: [["რეზოლუცია", "4მპ"], ["ობიექტივი", "2.8მმ"], ["კორპუსი", "Bullet"], ["IR მანძილი", "30მ"], ["მიკროფონი", "დიახ"]],
  },
  {
    sku: "02285", name: "ანალოგური კამერა - 5მპ 2.8მმ Dome, Turbo HD, HiLook",
    model: "THC-T150-P 2.8mm", category: "video-metvalyureoba", brand: "HiLook By HIKVISION",
    price: 68.78, oldPrice: 105.46, qty: 9,
    attrs: [["რეზოლუცია", "5მპ"], ["ობიექტივი", "2.8მმ"], ["კორპუსი", "Dome"], ["IR მანძილი", "20მ"]],
  },
  {
    sku: "02284", name: "ანალოგური კამერა - 5მპ 3.6მმ Mini Bullet, Turbo HD, HiLook",
    model: "THC-B150-P 3.6mm", category: "video-metvalyureoba", brand: "HiLook By HIKVISION",
    price: 71.44, oldPrice: 109.55, qty: 12,
    attrs: [["რეზოლუცია", "5მპ"], ["ობიექტივი", "3.6მმ"], ["კორპუსი", "Bullet"], ["IR მანძილი", "20მ"]],
  },
  {
    sku: "02959", name: "IP კამერა - 2მპ 2.8მმ Dome, Eco Series, HiLook",
    model: "IPC-D121H-C 2.8MM", category: "video-metvalyureoba", brand: "HiLook By HIKVISION",
    price: 78.84, oldPrice: 120.88, qty: 2,
    attrs: [["რეზოლუცია", "2მპ"], ["ობიექტივი", "2.8მმ"], ["კორპუსი", "Dome"], ["IR მანძილი", "30მ"]],
  },
  {
    sku: "02876", name: "4 არხიანი IP ვიდეო ჩამწერი NVR - 1 მყარი დისკი, Mini, HiLook",
    model: "NVR-104H-D", category: "video-metvalyureoba", brand: "HiLook By HIKVISION",
    price: 99.05, oldPrice: 151.87, qty: 2,
    attrs: [["არხების რაოდენობა", "4"], ["მყარი დისკი", "1"], ["მაქს. რეზოლუცია", "4მპ"]],
  },
  {
    sku: "02875", name: "8 არხიანი IP ვიდეო ჩამწერი NVR - 1 მყარი დისკი, 8 PoE პორტი, Mini, HiLook",
    model: "NVR-108H-D/8P", category: "video-metvalyureoba", brand: "HiLook By HIKVISION",
    price: 267.81, oldPrice: 410.64, qty: 4,
    attrs: [["არხების რაოდენობა", "8"], ["მყარი დისკი", "1"], ["PoE პორტები", "8"]],
  },
  {
    sku: "03958", name: "PTZ კამერების დისტანციურად სამართავი კონტროლერი, Uniview",
    model: "KB-1100-E", category: "video-metvalyureoba", brand: "Uniview",
    price: 1217.43, qty: 3,
    attrs: [["ტიპი", "კონტროლერი"], ["ინტერფეისი", "RS-485"]],
  },
  {
    sku: "02870", name: "IP ვიდეო დომოფონის გარე ბლოკი",
    model: "VDP-V6103", category: "dashvebis-sistema", brand: "HiLook By HIKVISION",
    price: 197.07, oldPrice: 302.18, qty: 6,
    attrs: [["ტიპი", "გარე ბლოკი"], ["რეზოლუცია", "2მპ"]],
  },
  {
    sku: "02257", name: "IP ვიდეო დომოფონი, კომპლექტი",
    model: "VDP-K603-P", category: "dashvebis-sistema", brand: "HiLook By HIKVISION",
    price: 442.87, oldPrice: 679.07, qty: 0, status: "IN_TRANSIT", incomingDate: "2026-09-20",
    attrs: [["ტიპი", "კომპლექტი"], ["ეკრანი", "7 დიუმი"]],
  },
  {
    sku: "04010", name: "სახანძრო სიგნალიზაციის მისამართიანი პანელი, UniPOS",
    model: "IFS7002-1", category: "sakhandzro-signalizacia", brand: "UniPOS",
    price: 1890, qty: 0, status: "PREORDER",
    attrs: [["ტიპი", "მისამართიანი"], ["მარყუჟები", "1"]],
  },
  {
    sku: "03721", name: "მყარი დისკი - 4TB, SkyHawk, ვიდეო-მეთვალყურეობისთვის, Seagate",
    model: "ST4000VX016", category: "myari-diskebi", brand: "Seagate",
    price: 389.5, qty: 18,
    attrs: [["ტევადობა", "4TB"], ["ინტერფეისი", "SATA III"], ["დანიშნულება", "ვიდეო-მეთვალყურეობა"]],
  },
  {
    sku: "03722", name: "მყარი დისკი - 8TB, Purple, ვიდეო-მეთვალყურეობისთვის, Western Digital",
    model: "WD84PURZ", category: "myari-diskebi", brand: "Western Digital",
    price: 742, qty: 7,
    attrs: [["ტევადობა", "8TB"], ["ინტერფეისი", "SATA III"], ["დანიშნულება", "ვიდეო-მეთვალყურეობა"]],
  },
  {
    sku: "03633", name: "მართვადი PoE სვიჩი - Pro Max 48 PoE, Ubiquiti",
    model: "USW-Pro-Max-48-PoE-EU", category: "svichebi", brand: "Ubiquiti",
    price: 6444.61, qty: 0, status: "IN_TRANSIT", incomingDate: "2026-10-05",
    attrs: [["პორტები", "48"], ["PoE", "დიახ"], ["მართვადი", "დიახ"]],
  },
  {
    sku: "03686", name: "მართვადი PoE სვიჩი - CSS106, Passive PoE, 1G, 4P, 1S, MikroTik",
    model: "CSS106-1G-4P-1S", category: "svichebi", brand: "MikroTik",
    price: 189.35, oldPrice: 240.22, qty: 11,
    attrs: [["პორტები", "5"], ["PoE", "დიახ"], ["მართვადი", "დიახ"]],
  },
  {
    sku: "03811", name: "მართვადი სვიჩი - 24 პორტი, 1G, L2, BDCOM",
    model: "S2510-24P", category: "svichebi", brand: "BDCOM",
    price: 1120, qty: 4, isNew: true,
    attrs: [["პორტები", "24"], ["PoE", "დიახ"], ["მართვადი", "დიახ"]],
  },
  {
    sku: "03902", name: "როუტერი - hEX S, Gigabit, MikroTik",
    model: "RB760iGS", category: "routerebi", brand: "MikroTik",
    price: 218.4, qty: 25,
    attrs: [["პორტები", "5"], ["SFP", "დიახ"], ["CPU", "880 MHz"]],
  },
  {
    sku: "03903", name: "როუტერი - RUTX50, 5G, სამრეწველო, Teltonika",
    model: "RUTX50", category: "routerebi", brand: "Teltonika",
    price: 1685, qty: 2, isNew: true,
    attrs: [["ქსელი", "5G"], ["პორტები", "5"], ["დანიშნულება", "სამრეწველო"]],
  },
  {
    sku: "03650", name: "WiFi 6 წვდომის წერტილი - U6 Pro, Ubiquiti",
    model: "U6-Pro", category: "wifi-access-point", brand: "Ubiquiti",
    price: 486.2, qty: 16,
    attrs: [["სტანდარტი", "WiFi 6"], ["სიჩქარე", "4.8 Gbps"], ["მონტაჟი", "ჭერზე"]],
  },
  {
    sku: "03651", name: "WiFi 6 წვდომის წერტილი - cAP ax, MikroTik",
    model: "cAPGi-5HaxD2HaxD", category: "wifi-access-point", brand: "MikroTik",
    price: 342.9, oldPrice: 398, qty: 9,
    attrs: [["სტანდარტი", "WiFi 6"], ["სიჩქარე", "1.8 Gbps"], ["მონტაჟი", "ჭერზე"]],
  },
  {
    sku: "03426", name: "კვების ბლოკი - 24V/350W, MEAN WELL",
    model: "LRS-350-24", category: "kvebis-blokebi", brand: "MEAN WELL",
    price: 69.73, qty: 40,
    attrs: [["ძაბვა", "24V"], ["სიმძლავრე", "350W"], ["ტიპი", "იმპულსური"]],
  },
  {
    sku: "03427", name: "კვების ბლოკი - 12V/150W, MEAN WELL",
    model: "LRS-150-12", category: "kvebis-blokebi", brand: "MEAN WELL",
    price: 48.2, qty: 55,
    attrs: [["ძაბვა", "12V"], ["სიმძლავრე", "150W"], ["ტიპი", "იმპულსური"]],
  },
  {
    sku: "03346", name: "DC-AC ინვერტორი - 24ვ, 1000ვტ, EPEVER",
    model: "IP1000-22-Plus(T)", category: "invertorebi", brand: "EPEVER",
    price: 807.92, qty: 6,
    attrs: [["ძაბვა", "24V"], ["სიმძლავრე", "1000W"], ["სინუსოიდი", "სუფთა"]],
  },
  {
    sku: "03347", name: "DC-AC ინვერტორი - 48ვ, 3000ვტ, EPEVER",
    model: "IP3000-42-Plus(T)", category: "invertorebi", brand: "EPEVER",
    price: 2140, qty: 0, status: "OUT_OF_STOCK",
    attrs: [["ძაბვა", "48V"], ["სიმძლავრე", "3000W"], ["სინუსოიდი", "სუფთა"]],
  },
  {
    sku: "03500", name: "უწყვეტი კვების წყარო - 1500VA, Line Interactive, LCD",
    model: "UPS-1500-LI", category: "ups", brand: "Other",
    price: 615, qty: 8,
    attrs: [["სიმძლავრე", "1500VA"], ["ტიპი", "Line Interactive"], ["ეკრანი", "LCD"]],
  },
  {
    sku: "03501", name: "უწყვეტი კვების წყარო - 3000VA, Online, Rack 2U",
    model: "UPS-3000-ON", category: "ups", brand: "Other",
    price: 2480, oldPrice: 2790, qty: 3, isNew: true,
    attrs: [["სიმძლავრე", "3000VA"], ["ტიპი", "Online"], ["მონტაჟი", "Rack 2U"]],
  },
];

function slugFor(name: string, sku: string) {
  const ka: Record<string, string> = {
    ა: "a", ბ: "b", გ: "g", დ: "d", ე: "e", ვ: "v", ზ: "z", თ: "t", ი: "i",
    კ: "k", ლ: "l", მ: "m", ნ: "n", ო: "o", პ: "p", ჟ: "zh", რ: "r", ს: "s",
    ტ: "t", უ: "u", ფ: "f", ქ: "q", ღ: "gh", ყ: "y", შ: "sh", ჩ: "ch",
    ც: "ts", ძ: "dz", წ: "w", ჭ: "ch", ხ: "kh", ჯ: "j", ჰ: "h",
  };
  const base = name
    .toLowerCase()
    .split("")
    .map((c) => ka[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base}-${sku}`;
}

async function main() {
  console.log("→ ადმინის შექმნა");
  await db.admin.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      name: "ადმინისტრატორი",
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
    },
    update: {},
  });

  console.log("→ კატეგორიები");
  const catBySlug = new Map<string, string>();
  for (const [i, root] of CATEGORIES.entries()) {
    const parent = await db.category.upsert({
      where: { slug: root.slug },
      create: { slug: root.slug, nameKa: root.name, sortOrder: i },
      update: { nameKa: root.name, sortOrder: i },
    });
    catBySlug.set(root.slug, parent.id);

    for (const [j, [childName, childSlug]] of root.children.entries()) {
      const child = await db.category.upsert({
        where: { slug: childSlug },
        create: { slug: childSlug, nameKa: childName, parentId: parent.id, sortOrder: j },
        update: { nameKa: childName, parentId: parent.id, sortOrder: j },
      });
      catBySlug.set(childSlug, child.id);
    }
  }

  // დემო-პროდუქტები მხოლოდ ლოკალურად. სერვერზე კატალოგი მიმწოდებლის API-დან მოდის —
  // ხელით შექმნილი ნიმუშები იქ ნამდვილ კოდებს ეჯახება და ფასებს ამახინჯებს.
  if (process.env.SEED_DEMO !== "1") {
    console.log("→ დემო-პროდუქტები გამოტოვებულია (SEED_DEMO=1 ჩართავს)");
    console.log(`
✓ მზადაა — ადმინი: ${ADMIN_EMAIL}`);
    return;
  }

  console.log("→ ბრენდები და პროდუქტები");
  for (const p of PRODUCTS) {
    const brandSlug = p.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const brand = await db.brand.upsert({
      where: { slug: brandSlug },
      create: { slug: brandSlug, name: p.brand },
      update: { name: p.brand },
    });

    const categoryId = catBySlug.get(p.category);
    if (!categoryId) throw new Error(`კატეგორია ვერ მოიძებნა: ${p.category}`);

    const data = {
      nameKa: p.name,
      model: p.model,
      price: p.price,
      oldPrice: p.oldPrice ?? null,
      stockQty: p.qty,
      stockStatus: p.status ?? (p.qty > 0 ? "IN_STOCK" : "OUT_OF_STOCK"),
      incomingDate: p.incomingDate ? new Date(p.incomingDate) : null,
      isNew: p.isNew ?? false,
      categoryId,
      brandId: brand.id,
      descriptionKa: `${p.name}\n\nმოდელი: ${p.model}\nოფიციალური გარანტია. დეტალური კონსულტაციისთვის დაგვიკავშირდით.`,
    };

    const product = await db.product.upsert({
      where: { sku: p.sku },
      create: { ...data, sku: p.sku, slug: slugFor(p.name, p.sku) },
      update: data,
    });

    await db.productAttribute.deleteMany({ where: { productId: product.id } });
    await db.productAttribute.createMany({
      data: p.attrs.map(([name, value], i) => ({
        productId: product.id,
        name,
        value,
        sortOrder: i,
      })),
    });
  }

  const count = await db.product.count();
  console.log(`\n✓ მზადაა — ${count} პროდუქტი`);
  console.log(`  ადმინი:  ${ADMIN_EMAIL}`);
  console.log(`  პაროლი:  ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
