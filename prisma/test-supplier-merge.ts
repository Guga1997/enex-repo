/** მეორე მიმწოდებელი იმავე ნივთზე — ერთი ბარათი, ნაშთი შეკრებილი */
import { PrismaClient } from "@prisma/client";
import { syncSupplier } from "../src/lib/suppliers";
import { serveFixture } from "./fixtures/serve";

const db = new PrismaClient();

async function main() {
  const server = await serveFixture("supplier-b.json", 4611);
  const supplier = await db.supplier.upsert({
    where: { slug: "mock-two" },
    update: { baseUrl: "http://127.0.0.1:4611/" },
    create: {
      slug: "mock-two",
      name: "მეორე კომპანია",
      adapter: "GENERIC_REST",
      baseUrl: "http://127.0.0.1:4611/",
      authType: "NONE",
      markupRetail: 25,
      markupDealer: 12,
      fieldMap: JSON.stringify({
        listPath: "items",
        sku: "code",
        name: "name",
        brand: "vendor",
        model: "sku_manuf",
        category: "cat",
        cost: "netto",
        qty: "stock",
      }),
    },
  });

  console.log("სინქი:", JSON.stringify(await syncSupplier(supplier.id)));

  const shared = await db.product.findFirst({
    where: { model: "EA903S-RT" },
    include: {
      supplies: { include: { supplier: true }, orderBy: { supplierSku: "asc" } },
      brand: true,
    },
  });

  if (!shared) return console.log("გაზიარებული პროდუქტი ვერ მოიძებნა");

  console.log(`\nპროდუქტი: ${shared.nameKa}`);
  console.log(`მოდელი: ${shared.model}  ბრენდი: ${shared.brand?.name}`);
  console.log(`ჯამური ნაშთი: ${shared.stockQty} (${shared.stockStatus})`);
  console.log("წყაროები:");
  for (const s of shared.supplies) {
    console.log(`   ${s.supplier.name}: კოდი ${s.supplierSku}, ${s.qty} ცალი, ღირებ. ${s.cost}`);
  }

  const cards = await db.product.count({ where: { model: "EA903S-RT" } });
  console.log(`\nბარათების რაოდენობა კატალოგში: ${cards}`);
  server.close();
}

main().finally(() => db.$disconnect());
