import { db } from "./db";
import { deriveStatus, planStockAdjust } from "./stock";
import { rollupStock } from "./suppliers";

/**
 * მარაგის ხელით შეცვლა ადმინიდან. მიმწოდებლის პროდუქტზე სხვაობა კორექციად ინახება,
 * რომ შემდეგმა სინქმა არ წაშალოს; ყოველი ცვლილება ლოგში ჩაიწერება.
 */
export async function setStock(productId: string, target: number, source: string, note?: string | null) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { sku: true, stockQty: true, stockStatus: true, supplies: { select: { qty: true } } },
  });
  if (!product) throw new Error("პროდუქტი ვერ მოიძებნა");

  if (product.supplies.length) {
    await db.product.update({
      where: { id: productId },
      data: { stockAdjust: planStockAdjust(product.supplies.map((s) => s.qty), target) },
    });
    await rollupStock(productId);
  } else {
    await db.product.update({
      where: { id: productId },
      data: { stockQty: target, stockAdjust: 0, stockStatus: deriveStatus(target, product.stockStatus) },
    });
  }
  await logChange(productId, product, source, note);
}

/** კორექციის მოხსნა — ნაშთი ისევ მიმწოდებლების ჯამი ხდება */
export async function clearStockAdjust(productId: string, source: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { sku: true, stockQty: true, stockStatus: true },
  });
  if (!product) throw new Error("პროდუქტი ვერ მოიძებნა");
  await db.product.update({ where: { id: productId }, data: { stockAdjust: 0 } });
  await rollupStock(productId);
  await logChange(productId, product, source, "კორექცია მოიხსნა");
}

async function logChange(
  productId: string,
  before: { sku: string; stockQty: number; stockStatus: string },
  source: string,
  note?: string | null
) {
  const after = await db.product.findUniqueOrThrow({
    where: { id: productId },
    select: { stockQty: true, stockStatus: true },
  });
  await db.stockSyncLog.create({
    data: {
      source,
      sku: before.sku,
      oldQty: before.stockQty,
      newQty: after.stockQty,
      oldStatus: before.stockStatus,
      newStatus: after.stockStatus,
      note: note?.trim() || null,
    },
  });
}
