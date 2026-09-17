import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { deriveStatus } from "./stock";
import { RESERVATION_MINUTES } from "./constants";
import { notifySalesPaid } from "./notify/sales";

/**
 * ნაშთის სასიცოცხლო ციკლი შეკვეთაში:
 *
 *   შეკვეთა შეიქმნა  → reservedQty += qty      (ნივთი დაკავებულია, სხვა ვერ იყიდის)
 *   გადახდა დადასტურდა → reservedQty −= qty, stockQty −= qty
 *   ჩავარდა / გაუქმდა / ვადა გავიდა → reservedQty −= qty  (ნივთი ისევ იყიდება)
 *
 * stockQty-ს პირდაპირ არასდროს ვაკლებთ გადახდამდე — სინქი მას ისედაც
 * მიმწოდებლის ციფრით გადააწერს, რეზერვაცია კი ცალკე ველში გადარჩება.
 */

type Tx = Prisma.TransactionClient;

/** სანამ ნაშთი დაკავებულია — ონლაინ გადახდას წუთები აქვს, გადარიცხვას დღეები */
export function reservationDeadline(paymentMethod: string): Date {
  const minutes = RESERVATION_MINUTES[paymentMethod] ?? RESERVATION_MINUTES.DEFAULT;
  return new Date(Date.now() + minutes * 60_000);
}

async function releaseItems(tx: Tx, items: { productId: string | null; qty: number }[]) {
  for (const item of items) {
    if (!item.productId) continue;
    const p = await tx.product.findUnique({ where: { id: item.productId }, select: { reservedQty: true } });
    if (!p) continue;
    await tx.product.update({
      where: { id: item.productId },
      data: { reservedQty: Math.max(0, p.reservedQty - item.qty) },
    });
  }
}

/**
 * გადახდილად მონიშვნა + ნაშთის ჩამოწერა.
 * იდემპოტენტურია — გადახდის სისტემა callback-ს რამდენჯერმე აგზავნის.
 */
export async function markOrderPaid(orderId: string, raw?: unknown, opts: { notify?: boolean } = {}) {
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return null;
    if (order.paymentStatus === "PAID") return { order, changed: false };

    for (const item of order.items) {
      if (!item.productId) continue;
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;

      const newQty = Math.max(0, product.stockQty - item.qty);
      await tx.product.update({
        where: { id: product.id },
        data: {
          stockQty: newQty,
          reservedQty: Math.max(0, product.reservedQty - item.qty),
          stockStatus: deriveStatus(newQty, product.stockStatus),
        },
      });
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "PAID",
        status: "PAID",
        reservedUntil: null,
        paymentRaw: raw ? JSON.stringify(raw) : order.paymentRaw,
      },
    });
    return { order: updated, changed: true };
  });

  // გაყიდვებს მხოლოდ რეალურ ცვლილებაზე — callback-ის გამეორება ორ წერილს არ აგზავნის.
  // ადმინი რომ ხელით ნიშნავს, თვითონვე იცის — notify: false.
  if (result?.changed && opts.notify !== false) {
    try {
      await notifySalesPaid(orderId);
    } catch (e) {
      console.error("გაყიდვების შეტყობინება ჩავარდა", e);
    }
  }
  return result?.order ?? null;
}

/** გადახდა ჩავარდა — რეზერვაცია იხსნება, შეკვეთა რჩება ხელახლა ცდისთვის */
export async function markOrderFailed(orderId: string, raw?: unknown) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.paymentStatus === "PAID") return order;

    // რეზერვაცია მხოლოდ ერთხელ იხსნება — reservedUntil ამის ნიშანია
    if (order.reservedUntil) await releaseItems(tx, order.items);

    return tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "FAILED",
        reservedUntil: null,
        paymentRaw: raw ? JSON.stringify(raw) : undefined,
      },
    });
  });
}

/** გაუქმება — ადმინიდან ან ვადის გასვლით. ნაშთი უბრუნდება. */
export async function cancelOrder(orderId: string, status: "CANCELLED" | "EXPIRED" = "CANCELLED") {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.paymentStatus === "PAID") return order;

    if (order.reservedUntil) await releaseItems(tx, order.items);

    return tx.order.update({
      where: { id: orderId },
      data: { status, reservedUntil: null },
    });
  });
}

/**
 * ვადაგასული რეზერვაციების გათავისუფლება — cron-იდან წუთში ერთხელ.
 * აბრუნებს, რამდენი შეკვეთა გაუქმდა.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const expired = await db.order.findMany({
    where: {
      reservedUntil: { lt: new Date() },
      paymentStatus: { not: "PAID" },
      status: "PENDING",
    },
    select: { id: true },
  });
  for (const o of expired) await cancelOrder(o.id, "EXPIRED");
  return expired.length;
}
