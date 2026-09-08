import { db } from "./db";
import { deriveStatus } from "./stock";

/**
 * შეკვეთის გადახდილად მონიშვნა + ნაშთის ჩამოწერა.
 * იდემპოტენტურია — გადახდის სისტემა callback-ს რამდენჯერმე აგზავნის.
 */
export async function markOrderPaid(orderId: string, raw?: unknown) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return null;
    if (order.paymentStatus === "PAID") return order; // უკვე დამუშავებულია

    for (const item of order.items) {
      if (!item.productId) continue;
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;

      const newQty = Math.max(0, product.stockQty - item.qty);
      await tx.product.update({
        where: { id: product.id },
        data: { stockQty: newQty, stockStatus: deriveStatus(newQty, product.stockStatus) },
      });
    }

    return tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "PAID",
        status: "PAID",
        paymentRaw: raw ? JSON.stringify(raw) : order.paymentRaw,
      },
    });
  });
}

export async function markOrderFailed(orderId: string, raw?: unknown) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.paymentStatus === "PAID") return order;

  return db.order.update({
    where: { id: orderId },
    data: { paymentStatus: "FAILED", paymentRaw: raw ? JSON.stringify(raw) : undefined },
  });
}
