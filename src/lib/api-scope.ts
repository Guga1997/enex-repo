import { db } from "./db";
import { categoryIdsWithDescendants } from "./catalog";

/**
 * API გასაღების კატეგორიული შეზღუდვა.
 *
 * გასაღებს შეიძლება მიეთითოს ერთი კატეგორია — მაშინ ის მხოლოდ მას და მის
 * ქვეკატეგორიებს ხედავს და ცვლის. საწყობის აპლიკაციის გასაღები ასეა შეზღუდული
 * კომპიუტერის კომპონენტებზე: გაჟონვის შემთხვევაშიც დანარჩენ კატალოგს ვერ შეეხება.
 *
 * `null` — შეზღუდვა არ აქვს (ძველი გასაღებები, ERP-ის სრული სინქრონიზაცია).
 */
export async function scopeIds(categorySlug: string | null): Promise<string[] | null> {
  if (!categorySlug) return null;
  const cat = await db.category.findUnique({ where: { slug: categorySlug }, select: { id: true } });
  if (!cat) return []; // კატეგორია წაიშალა — გასაღები ვერაფერს ხედავს
  return categoryIdsWithDescendants(cat.id);
}

/** პროდუქტი ხვდება თუ არა გასაღების არეალში */
export async function inScope(categorySlug: string | null, productCategoryId: string): Promise<boolean> {
  const ids = await scopeIds(categorySlug);
  return ids === null || ids.includes(productCategoryId);
}

export const OUT_OF_SCOPE = "ეს გასაღები ამ პროდუქტს არ ეხება";
