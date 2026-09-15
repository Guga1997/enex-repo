/**
 * მიმწოდებლების სურათებისა და დოკუმენტების ჩვენს დისკზე გადმოტანა.
 *
 *   npx tsx scripts/localize-media.ts          # სურათები
 *   npx tsx scripts/localize-media.ts --docs   # სურათები + დოკუმენტები
 *   npx tsx scripts/localize-media.ts --dry    # მხოლოდ დათვლა
 *
 * გამეორება უსაფრთხოა — უკვე ჩამოტვირთული ფაილი მეორედ არ მოდის.
 */
import { PrismaClient } from "@prisma/client";
import { localizeMedia } from "../src/lib/media";

const db = new PrismaClient();
const dry = process.argv.includes("--dry");
const withDocs = process.argv.includes("--docs");

async function main() {
  const [images, docs] = await Promise.all([
    db.productImage.count({ where: { url: { startsWith: "http" } } }),
    db.productDocument.count({ where: { url: { startsWith: "http" } } }),
  ]);
  console.log(`უცხო მისამართი: ${images} სურათი, ${docs} დოკუმენტი` + (withDocs ? "" : " (დოკუმენტები არ ჩამოვა)"));
  if (dry || images + (withDocs ? docs : 0) === 0) return;

  const started = Date.now();
  let last = 0;
  const stats = await localizeMedia({
    docs: withDocs,
    onProgress: (done, total) => {
      if (done - last >= 50 || done === total) {
        last = done;
        process.stdout.write(`\r  ${done}/${total}  (${Math.round((Date.now() - started) / 1000)}წმ)`);
      }
    },
  });
  console.log();

  const mb = (b: number) => (b / 1048576).toFixed(1) + " მბ";
  console.log(`სურათი:    ${stats.images.done} ჩამოვიდა (${mb(stats.images.bytes)}), ${stats.images.failed} ჩავარდა`);
  console.log(`დოკუმენტი: ${stats.docs.done} ჩამოვიდა (${mb(stats.docs.bytes)}), ${stats.docs.failed} ჩავარდა`);
  if (stats.errors.length) {
    console.log("\nჩავარდნილი (პირველი 20):");
    for (const e of stats.errors) console.log("  " + e);
  }
}

main().finally(() => db.$disconnect());
