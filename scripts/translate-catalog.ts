/**
 * კატალოგის თარგმნა: კატეგორიებსა და პროდუქტებს ავსებს nameEn/nameRu-ს
 * (და აღწერებს) data/category-i18n.json და data/phrases-i18n.json-ის მიხედვით.
 * იდემპოტენტურია — ხელახლა გაშვება მხოლოდ ცვლილებებს წერს.
 *
 *   npx tsx scripts/translate-catalog.ts          — რაც ცარიელია, ის შეივსება
 *   npx tsx scripts/translate-catalog.ts --force  — არსებული თარგმანებიც გადაიწერება
 */
import { db } from "../src/lib/db";
import { translateName, translateCategory } from "../src/lib/i18n/translate-name";

const force = process.argv.includes("--force");

(async () => {
  let cats = 0;
  for (const c of await db.category.findMany()) {
    const en = force || !c.nameEn ? translateCategory(c.nameKa, "en") : null;
    const ru = force || !c.nameRu ? translateCategory(c.nameKa, "ru") : null;
    if (!en && !ru) continue;
    await db.category.update({
      where: { id: c.id },
      data: { ...(en ? { nameEn: en } : {}), ...(ru ? { nameRu: ru } : {}) },
    });
    cats++;
  }

  let prods = 0, partial = 0;
  const all = await db.product.findMany({
    select: { id: true, nameKa: true, nameEn: true, nameRu: true, descriptionKa: true, descriptionEn: true, descriptionRu: true },
  });
  for (const p of all) {
    const data: Record<string, string> = {};
    if (force || !p.nameEn) { const v = translateName(p.nameKa, "en"); if (v) data.nameEn = v; }
    if (force || !p.nameRu) { const v = translateName(p.nameKa, "ru"); if (v) data.nameRu = v; }
    if (p.descriptionKa) {
      if (force || !p.descriptionEn) { const v = translateName(p.descriptionKa, "en"); if (v) data.descriptionEn = v; }
      if (force || !p.descriptionRu) { const v = translateName(p.descriptionKa, "ru"); if (v) data.descriptionRu = v; }
    }
    if (!Object.keys(data).length) { partial++; continue; }
    await db.product.update({ where: { id: p.id }, data });
    prods++;
  }

  console.log(`კატეგორია: ${cats} განახლდა`);
  console.log(`პროდუქტი: ${prods} ითარგმნა, ${partial} ქართულად დარჩა (ფრაზა ლექსიკონში არ იყო)`);
  await db.$disconnect();
})();
