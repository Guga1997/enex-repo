/** intellcom-ის ადაპტერის შემოწმება დოკუმენტაციის ფორმატზე */
import { PrismaClient } from "@prisma/client";
import { syncSupplier, resolveAdapter } from "../src/lib/suppliers";

const db = new PrismaClient();
const BASE = "http://127.0.0.1:4601/ws/v1.4/products";

async function main() {
  const supplier = await db.supplier.upsert({
    where: { slug: "intellcom" },
    update: { adapter: "INTELLCOM", baseUrl: BASE, secret: "testkey" },
    create: {
      slug: "intellcom",
      name: "Intellcom",
      adapter: "INTELLCOM",
      baseUrl: BASE,
      authType: "NONE",
      secret: "testkey",
      markupRetail: 25,
      markupDealer: 12,
      fieldMap: JSON.stringify({ identificationCode: "405123456" }),
    },
  });

  // 1. არასწორი გასაღები — დოკუმენტაციის შეცდომა უნდა დაბრუნდეს ქართულად
  try {
    await resolveAdapter("INTELLCOM").fetchItems({
      slug: "x", name: "x", baseUrl: BASE, authType: "NONE",
      secret: "badkey", authHeader: null,
      fieldMap: JSON.stringify({ identificationCode: "405123456" }),
    });
    console.log("✗ არასწორმა გასაღებმა შეცდომა არ დააბრუნა");
  } catch (e) {
    console.log("✓ არასწორი გასაღები: " + (e as Error).message);
  }

  // 2. სრული სინქი
  console.log("\nსინქი:", JSON.stringify(await syncSupplier(supplier.id)));

  const supplies = await db.productSupply.findMany({
    where: { supplierId: supplier.id },
    include: {
      product: {
        include: {
          category: true, brand: true,
          attributes: true, documents: true, images: true,
        },
      },
    },
    orderBy: { supplierSku: "asc" },
  });

  for (const s of supplies) {
    const p = s.product;
    console.log(
      `\n#${s.supplierSku}  ${p.nameKa}\n` +
        `   კატეგორია: ${p.category.nameKa}   ბრენდი: ${p.brand?.name ?? "—"}\n` +
        `   ღირებ.: ${p.cost}  →  საცალო ${p.price} / სადილერო ${p.dealerPrice}\n` +
        `   ნაშთი: ${p.stockQty} (${p.stockStatus})  გარანტია: ${p.warrantyMonths} თვე\n` +
        `   წონა: ${p.weightKg} კგ  მოცულობა: ${p.volumeM3} მ³\n` +
        `   მახასიათებელი: ${p.attributes.length}  დოკუმენტი: ${p.documents.length}  სურათი: ${p.images.length}`
    );
  }
}

main().finally(() => db.$disconnect());
