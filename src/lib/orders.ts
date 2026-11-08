import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { deriveStatus, splitSale } from "./stock";
import { RESERVATION_MINUTES } from "./constants";
import { notifySalesPaid } from "./notify/sales";

/**
 * ნაშთის სასიცოცხლო ციკლი შეკვეთაში:
 *
 *   შეკვეთა შეიქმნა  → reservedQty += qty      (ნივთი დაკავებულია, სხვა ვერ იყიდის)
 *   გადახდა დადასტურდა → reservedQty −= qty, stockQty −= qty
 *   ჩავარდა / გაუქმდა / ვადა გავიდა → reservedQty −= qty  (ნივთი ისევ იყიდება)
 *
 * რამდენი ცალი უჭირავს თითო ხაზს, OrderItem.reservedQty-შია — იხსნება ზუსტად ეს და
 * ნულდება. ასე წინასწარი შეკვეთის ხაზი (რომელიც არაფერს იკავებს) ან მეორედ მოსული
 * callback სხვა მყიდველის რეზერვაციას ვეღარ „გაათავისუფლებს“.
 *
 * შეკვეთის მდგომარეობის ყოველი გადასვლა პირობითი updateMany-ით იწყება („მხოლოდ თუ ჯერ
 * კიდევ გადაუხდელია“). ორი ერთდროული გამოძახებიდან (ბანკის callback + მყიდველის
 * დაბრუნება) მეორე ბაზის რიგის ლოკზე ელოდება და 0 რიგს იღებს — ნაშთი ორჯერ აღარ ჩამოიწერება.
 */

type Tx = Prisma.TransactionClient;

/** სანამ ნაშთი დაკავებულია — ონლაინ გადახდას წუთები აქვს, გადარიცხვას დღეები */
export function reservationDeadline(paymentMethod: string): Date {
  const minutes = RESERVATION_MINUTES[paymentMethod] ?? RESERVATION_MINUTES.DEFAULT;
  return new Date(Date.now() + minutes * 60_000);
}

/**
 * პროდუქტის რიგის ჩაკეტვა ტრანზაქციის ბოლომდე (Postgres: row lock). ამის შემდეგ წაკითხული
 * ციფრები ახალია და ერთდროული გაყიდვა/რეზერვაცია ერთმანეთს აღარ გადააწერს.
 */
export async function lockProduct(tx: Tx, productId: string) {
  await tx.$executeRaw`UPDATE "Product" SET "reservedQty" = "reservedQty" WHERE "id" = ${productId}`;
}

/**
 * ნაშთის დაკავება მხოლოდ თუ საკმარისია — ერთი SQL ბრძანება, შემოწმება და ჩაწერა ერთად.
 * false — ამ წამს სხვამ დაიკავა.
 */
export async function reserveStock(tx: Tx, productId: string, qty: number): Promise<boolean> {
  const n = await tx.$executeRaw`
    UPDATE "Product" SET "reservedQty" = "reservedQty" + ${qty}
    WHERE "id" = ${productId} AND "stockQty" - "reservedQty" >= ${qty}`;
  return n > 0;
}

/** ხაზების რეზერვაციის მოხსნა — მხოლოდ ის, რაც ამ ხაზს მართლა უჭირავს */
async function releaseItems(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({
    where: { orderId, reservedQty: { gt: 0 } },
    select: { id: true, productId: true, reservedQty: true },
  });
  for (const item of items) {
    if (item.productId) {
      await lockProduct(tx, item.productId);
      const p = await tx.product.findUnique({ where: { id: item.productId }, select: { reservedQty: true } });
      if (p) {
        await tx.product.update({
          where: { id: item.productId },
          data: { reservedQty: Math.max(0, p.reservedQty - item.reservedQty) },
        });
      }
    }
    await tx.orderItem.update({ where: { id: item.id }, data: { reservedQty: 0 } });
  }
}

/**
 * გადახდილად მონიშვნა + ნაშთის ჩამოწერა.
 * იდემპოტენტურია — გადახდის სისტემა callback-ს რამდენჯერმე აგზავნის, მყიდველის
 * დაბრუნებაც იმავე წამს შეიძლება მოვიდეს.
 */
export async function markOrderPaid(orderId: string, raw?: unknown, opts: { notify?: boolean } = {}) {
  const result = await db.$transaction(async (tx) => {
    const before = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, reservedUntil: true } });
    if (!before) return null;

    const claim = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: { not: "PAID" } },
      data: {
        paymentStatus: "PAID",
        status: "PAID",
        reservedUntil: null,
        ...(raw ? { paymentRaw: JSON.stringify(raw) } : {}),
      },
    });
    if (claim.count === 0) {
      return { order: await tx.order.findUnique({ where: { id: orderId } }), changed: false, late: false };
    }

    // ვადა უკვე გასული იყო — ფული მოვიდა, მაგრამ ნაშთი შეიძლება სხვას მიჰყიდა
    const late = !before.reservedUntil && (before.status === "EXPIRED" || before.status === "CANCELLED");

    // ხაზებს მხოლოდ ახლა ვკითხულობთ — შეკვეთის რიგი ჩვენია, გაუქმება შუაში ვეღარ ჩაერევა
    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      if (!item.productId) continue;
      await lockProduct(tx, item.productId);
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        include: { supplies: { select: { id: true, qty: true }, orderBy: { qty: "desc" } } },
      });
      if (!product) continue;

      // ჯერ ჩემი მარაგი, მერე მიმწოდებლისა — შემდეგი სინქი მიმწოდებლის ციფრს თავიდან დაწერს
      const split = splitSale(product.stockAdjust, product.supplies.map((s) => s.qty), item.qty);
      for (const [i, supply] of product.supplies.entries()) {
        if (split.supplies[i] !== supply.qty) {
          await tx.productSupply.update({ where: { id: supply.id }, data: { qty: split.supplies[i] } });
        }
      }

      const newQty = Math.max(0, product.stockQty - item.qty);
      await tx.product.update({
        where: { id: product.id },
        data: {
          stockQty: newQty,
          stockAdjust: split.own,
          reservedQty: Math.max(0, product.reservedQty - item.reservedQty),
          stockStatus: deriveStatus(newQty, product.stockStatus),
        },
      });
      if (item.reservedQty) await tx.orderItem.update({ where: { id: item.id }, data: { reservedQty: 0 } });
    }

    return { order: await tx.order.findUnique({ where: { id: orderId } }), changed: true, late };
  });

  // გაყიდვებს მხოლოდ რეალურ ცვლილებაზე — callback-ის გამეორება ორ წერილს არ აგზავნის.
  // ადმინი რომ ხელით ნიშნავს, თვითონვე იცის — notify: false.
  if (result?.changed && (opts.notify !== false || result.late)) {
    try {
      await notifySalesPaid(orderId, { late: result.late });
    } catch (e) {
      console.error("გაყიდვების შეტყობინება ჩავარდა", e);
    }
  }
  return result?.order ?? null;
}

/**
 * გადახდა ჩავარდა — რეზერვაცია იხსნება და შეკვეთა უქმდება (ბანკის მხარეს ეს
 * გადახდა დასრულებულია; თავიდან ცდა ახალ შეკვეთად ფორმდება, კალათა ინახება).
 */
export async function markOrderFailed(orderId: string, raw?: unknown) {
  return db.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: { notIn: ["PAID", "FAILED"] } },
      data: {
        paymentStatus: "FAILED",
        reservedUntil: null,
        ...(raw ? { paymentRaw: JSON.stringify(raw) } : {}),
      },
    });
    if (claim.count) {
      await tx.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "CANCELLED" } });
      await releaseItems(tx, orderId);
    }
    return tx.order.findUnique({ where: { id: orderId } });
  });
}

/**
 * გაუქმება — ადმინიდან ან ვადის გასვლით. ნაშთი უბრუნდება.
 * გადახდილს არ ეხება; ვადით მხოლოდ მოლოდინში მყოფი უქმდება (თანამშრომელმა თუ
 * „მუშავდება“-ზე გადაიყვანა, ტაიმერი აღარ აუქმებს).
 */
export async function cancelOrder(orderId: string, status: "CANCELLED" | "EXPIRED" = "CANCELLED") {
  return db.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      where: {
        id: orderId,
        paymentStatus: { not: "PAID" },
        status: status === "EXPIRED" ? "PENDING" : { notIn: ["CANCELLED", "EXPIRED"] },
      },
      data: { status, reservedUntil: null },
    });
    if (claim.count) await releaseItems(tx, orderId);
    return tx.order.findUnique({ where: { id: orderId } });
  });
}
