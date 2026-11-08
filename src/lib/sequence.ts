import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * თანმიმდევრული ნომერი (ORD-2026-00042, INV-2026-00007).
 *
 * ძველი ვარიანტი — count()+1 — ორ ერთდროულ შეკვეთას ერთ ნომერს აძლევდა, ერთის წაშლის
 * შემდეგ კი უკვე არსებულ ნომერს და ყველა შემდეგი შეკვეთა ჩავარდებოდა. მრიცხველი ერთი
 * რიგია, upsert-ი ბაზაში ატომურია (Postgres: INSERT … ON CONFLICT DO UPDATE).
 *
 * პირველად წლის დასაწყისში მრიცხველი არსებული ნომრების მაქსიმუმიდან იწყება.
 */
export async function nextNumber(
  tx: Tx,
  prefix: string,
  existingMax: () => Promise<string | null | undefined>
): Promise<string> {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;

  let start = 0;
  if (!(await tx.counter.findUnique({ where: { key } }))) {
    start = parseTail(await existingMax(), key);
  }
  const c = await tx.counter.upsert({
    where: { key },
    create: { key, value: start + 1 },
    update: { value: { increment: 1 } },
  });
  return `${key}-${String(c.value).padStart(5, "0")}`;
}

/** "ORD-2026-00041" → 41; სხვა წლის ან ფორმატის ნომერი → 0 */
export function parseTail(num: string | null | undefined, key: string): number {
  if (!num || !num.startsWith(key + "-")) return 0;
  const n = Number(num.slice(key.length + 1));
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export const orderNumber = (tx: Tx) =>
  nextNumber(tx, "ORD", async () =>
    (await tx.order.findFirst({
      where: { number: { startsWith: `ORD-${new Date().getFullYear()}-` } },
      orderBy: { number: "desc" },
      select: { number: true },
    }))?.number
  );

export const invoiceNumber = (tx: Tx) =>
  nextNumber(tx, "INV", async () =>
    (await tx.order.findFirst({
      where: { invoiceNumber: { startsWith: `INV-${new Date().getFullYear()}-` } },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    }))?.invoiceNumber
  );
