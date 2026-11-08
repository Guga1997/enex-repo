import { db } from "./db";
import { deriveStatus } from "./stock";
import { rollupStock } from "./suppliers";

/**
 * გარე სისტემიდან (API, საწყობის აპლიკაცია) ნაშთისა და ფასის ჩაწერის საერთო წესები.
 *
 * ნაშთი: მიმწოდებლის პროდუქტზე სინქი stockQty-ს თავიდან ითვლის — ამიტომ API-ს რიცხვი
 * „სულ“-ად აღიქმება და „ჩემ მარაგში“ იწერება (სულ − მიმწოდებლების ჯამი). მიმწოდებლის
 * გარეშე პროდუქტზე — პირდაპირ.
 *
 * ფასი: 0 ან თვითღირებულებაზე დაბალი არ მიიღება; ჩაწერილი ფასი იკეტება, რომ სინქმა არ
 * გადააწეროს (ისევე, როგორც ადმინში „ხელით“).
 */
export const PUBLIC_PRODUCT_SELECT = {
  id: true, sku: true, slug: true, nameKa: true, nameEn: true, nameRu: true, model: true,
  descriptionKa: true, price: true, oldPrice: true, stockQty: true, reservedQty: true, stockStatus: true,
  incomingDate: true, isActive: true, isNew: true, minQty: true, qtyStep: true, unit: true,
  warrantyMonths: true, weightKg: true, volumeM3: true, createdAt: true, updatedAt: true,
  brand: { select: { name: true, slug: true } },
  category: { select: { nameKa: true, slug: true } },
  images: { select: { url: true }, orderBy: { sortOrder: "asc" as const } },
  attributes: { select: { name: true, value: true } },
} as const;

export function checkPrice(price: number, cost: number | null): string | null {
  if (!(price > 0)) return "ფასი 0-ზე მეტი უნდა იყოს";
  if (cost && price < cost) return `ფასი (${price}) თვითღირებულებაზე (${cost}) დაბალია`;
  return null;
}

/** qty = სულ რამდენი იყიდება. აბრუნებს ახალ stockQty-ს და სტატუსს */
export async function writeApiQty(productId: string, qty: number, status?: string) {
  const p = await db.product.findUniqueOrThrow({
    where: { id: productId },
    select: { stockStatus: true, supplies: { select: { qty: true } } },
  });
  if (p.supplies.length) {
    const supplierSum = p.supplies.reduce((s, x) => s + Math.max(0, x.qty), 0);
    await db.product.update({ where: { id: productId }, data: { stockAdjust: Math.max(0, qty - supplierSum) } });
    await rollupStock(productId);
    if (status) await db.product.update({ where: { id: productId }, data: { stockStatus: status } });
  } else {
    await db.product.update({
      where: { id: productId },
      data: { stockQty: qty, stockStatus: status ?? deriveStatus(qty, p.stockStatus) },
    });
  }
  return db.product.findUniqueOrThrow({ where: { id: productId }, select: { stockQty: true, stockStatus: true } });
}
