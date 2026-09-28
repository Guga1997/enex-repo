/**
 * კომპიუტერის კომპონენტების კატეგორიები enex.ge-ზე.
 * კონფიგურატორის აპლიკაცია ამ slug-ებით ცნობს, რომელი ნაწილია პროდუქტი.
 *
 *   npx tsx scripts/seed-pc-categories.ts            — შექმნის (გამორთულად)
 *   npx tsx scripts/seed-pc-categories.ts --active   — მაშინვე გამოაჩენს მენიუში
 *
 * იდემპოტენტურია: არსებულს არ შლის, მხოლოდ სახელებს/თარგმანებს აახლებს.
 */
import { db } from "../src/lib/db";
import { PC_CATEGORIES, PC_ROOT } from "../src/lib/pc-build/specs";

const active = process.argv.includes("--active");

(async () => {
  const root = await db.category.upsert({
    where: { slug: PC_ROOT.slug },
    create: {
      slug: PC_ROOT.slug,
      nameKa: PC_ROOT.nameKa,
      nameEn: PC_ROOT.nameEn,
      nameRu: PC_ROOT.nameRu,
      isActive: active,
      sortOrder: 80,
    },
    update: { nameEn: PC_ROOT.nameEn, nameRu: PC_ROOT.nameRu, ...(active ? { isActive: true } : {}) },
  });
  console.log(`root: ${root.nameKa} (${root.slug})`);

  for (const [i, c] of PC_CATEGORIES.entries()) {
    const cat = await db.category.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        nameKa: c.nameKa,
        nameEn: c.nameEn,
        nameRu: c.nameRu,
        parentId: root.id,
        isActive: active,
        sortOrder: i,
      },
      update: { nameEn: c.nameEn, nameRu: c.nameRu, parentId: root.id, ...(active ? { isActive: true } : {}) },
    });
    const n = await db.product.count({ where: { categoryId: cat.id } });
    console.log(`  ${c.id.padEnd(8)} ${c.slug.padEnd(24)} ${cat.nameKa} — ${n} პროდუქტი`);
  }

  console.log(
    active
      ? "\n✓ კატეგორიები ჩანს საიტზე"
      : "\n✓ კატეგორიები შექმნილია, ჯერ დამალულია — --active გამოაჩენს"
  );
  await db.$disconnect();
})();
