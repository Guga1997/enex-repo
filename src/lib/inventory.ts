import { db } from "./db";
import { deriveStatus } from "./stock";
import { rollupStock } from "./suppliers";

/**
 * „ჩემი მარაგი“ ადმინიდან. მიმწოდებლის პროდუქტზე ცალკე ველში ინახება და მის ნაშთს
 * ემატება — სინქი მას არ ეხება. მიმწოდებლის გარეშე პროდუქტის ნაშთი მთლიანად ჩვენია
 * და პირდაპირ იწერება. ყოველი ცვლილება ლოგში ჩაიწერება.
 */
export async function setOwnStock(productId: string, ownQty: number, source: string, note?: string | null) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { sku: true, stockQty: true, stockStatus: true, _count: { select: { supplies: true } } },
  });
  if (!product) throw new Error("პროდუქტი ვერ მოიძებნა");

  if (product._count.supplies) {
    await db.product.update({ where: { id: productId }, data: { stockAdjust: ownQty } });
    await rollupStock(productId);
  } else {
    await db.product.update({
      where: { id: productId },
      data: { stockQty: ownQty, stockStatus: deriveStatus(ownQty, product.stockStatus) },
    });
  }

  const after = await db.product.findUniqueOrThrow({
    where: { id: productId },
    select: { stockQty: true, stockStatus: true },
  });
  await db.stockSyncLog.create({
    data: {
      source,
      sku: product.sku,
      oldQty: product.stockQty,
      newQty: after.stockQty,
      oldStatus: product.stockStatus,
      newStatus: after.stockStatus,
      note: note?.trim() || null,
    },
  });
}
