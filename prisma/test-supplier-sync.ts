/** ერთჯერადი შემოწმება: ყალბი მიმწოდებლის API სინქდება თუ არა ბოლომდე */
import { PrismaClient } from "@prisma/client";
import { syncSupplier } from "../src/lib/suppliers";
import { serveFixture } from "./fixtures/serve";

const db = new PrismaClient();

async function main() {
  const server = await serveFixture("supplier-a.json", 4610);
  const supplier = await db.supplier.upsert({
    where: { slug: "mock-co" },
    update: { baseUrl: "http://127.0.0.1:4610/" },
    create: {
      slug: "mock-co",
      name: "სატესტო კომპანია",
      adapter: "GENERIC_REST",
      baseUrl: "http://127.0.0.1:4610/",
      authType: "NONE",
      markupRetail: 30,
      markupDealer: 15,
      fieldMap: JSON.stringify({
        listPath: "payload.goods",
        sku: "article",
        name: "title",
        brand: "manufacturer",
        model: "part_no",
        category: "group",
        cost: "wholesale",
        qty: "balance",
        incomingDate: "eta",
        weightKg: "weight",
        volumeM3: "volume",
        warrantyMonths: "warranty",
        images: "photos",
      }),
    },
  });

  const res = await syncSupplier(supplier.id);
  console.log("სინქი:", JSON.stringify(res));

  const supplies = await db.productSupply.findMany({
    where: { supplierId: supplier.id },
    include: { product: { include: { category: true, brand: true } } },
    orderBy: { supplierSku: "asc" },
  });

  for (const s of supplies) {
    const p = s.product;
    console.log(
      `${s.supplierSku}  qty=${s.qty}  →  ${p.nameKa}\n` +
        `    კატეგორია: ${p.category.nameKa}  ბრენდი: ${p.brand?.name ?? "—"}\n` +
        `    ღირებ.: ${p.cost}  საცალო: ${p.price}  სადილერო: ${p.dealerPrice}\n` +
        `    ნაშთი: ${p.stockQty} (${p.stockStatus})` +
        (p.incomingDate ? ` ჩამოსვლა: ${p.incomingDate.toISOString().slice(0, 10)}` : "")
    );
  }
  server.close();
}

main().finally(() => db.$disconnect());
