import { z } from "zod";
import { db } from "./db";
import { DELIVERY_CITIES, deliveryFeeFor } from "./constants";
import { availableQty, isPurchasable, normalizeQty } from "./stock";
import { markOrderPaid, cancelOrder, reservationDeadline, reserveStock } from "./orders";
import { orderNumber } from "./sequence";
import { effectivePrice } from "./pricing";
import { INTERNAL_NOTE, issueAndSendInvoice } from "./invoice";
import { notifySalesNewOrder } from "./notify/sales";

/**
 * თანამშრომლის (გაყიდვების) შექმნილი შეკვეთა მყიდველის სახელზე — ორი სახე:
 *
 *   INVOICE — ინვოისი საბანკო გადარიცხვით (ნომერი მაშინვე, სურვილით ელფოსტაზე);
 *   STORE   — მაღაზიის გაყიდვა: მყიდველმა დარეკა ან მოვიდა. გაყიდვები ამზადებს, ფულის მიღების
 *             შემდეგ ერთი ღილაკით ადასტურებს („გაიყიდა“) — ნაშთი მაშინ ჩამოიწერება, ისევე,
 *             როგორც ონლაინ გადახდისას. საიტზე არარსებული ნივთიც ჩაიწერება (სახელი + ფასი).
 *
 * საიტის ნივთზე იგივე წესებია, რაც მყიდველისთვის: ფასი საიტის საცალოა (თანამშრომელი ვერ ცვლის),
 * ნაშთი მოწმდება და იკავება, მიწოდების საფასური ქალაქით ითვლება.
 */
export const staffOrderSchema = z.object({
  kind: z.enum(["INVOICE", "STORE"]).default("INVOICE"),
  customerName: z.string().trim().min(2, "მიუთითე მყიდველის სახელი და გვარი"),
  customerPhone: z.string().trim().max(40).default(""),
  // ელფოსტა არასავალდებულოა — ინვოისი შეიძლება დაიბეჭდოს ან ხელით გადაეცეს
  customerEmail: z.union([z.literal(""), z.string().trim().email("არასწორი ელფოსტა")]).default(""),
  customerId: z.string().trim().max(20).default(""),
  companyName: z.string().trim().max(200).default(""),
  deliveryMethod: z.enum(["COURIER", "PICKUP"]),
  deliveryCity: z.string().trim().default(""),
  deliveryAddress: z.string().trim().max(300).default(""),
  comment: z.string().trim().max(800).default(""),
  sendEmail: z.boolean().default(false),
  items: z
    .array(z.object({ productId: z.string(), qty: z.number().int().min(1).max(100000) }))
    .max(200, "ძალიან ბევრი პოზიციაა")
    .default([]),
  /** საიტზე არარსებული ნივთი — მხოლოდ მაღაზიის გაყიდვაში; ნაშთს არ ეხება */
  customItems: z
    .array(
      z.object({
        name: z.string().trim().min(2, "სხვა ნივთს დასახელება სჭირდება").max(200),
        price: z.number().positive("სხვა ნივთს ფასი სჭირდება").max(10_000_000),
        qty: z.number().int().min(1).max(100000),
      })
    )
    .max(50)
    .default([]),
});
/** ძველი სახელი — ინვოისის გვერდი და ტესტები ამას იყენებს */
export const staffInvoiceSchema = staffOrderSchema;
export type StaffOrderInput = z.input<typeof staffOrderSchema>;
export type StaffInvoiceInput = StaffOrderInput;

class StaffOrderError extends Error {}

export type StaffInvoiceResult =
  | { ok: true; orderId: string; number: string; invoiceNumber: string | null; emailed: boolean; emailError?: string }
  | { ok: false; error: string };

export async function createStaffOrder(raw: unknown, staff: { name: string }): Promise<StaffInvoiceResult> {
  const parsed = staffOrderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "შეავსე ყველა ველი" };
  const input = parsed.data;
  const store = input.kind === "STORE";

  if (!input.items.length && !(store && input.customItems.length)) return { ok: false, error: "აირჩიე ერთი პროდუქტი მაინც" };
  if (!store && input.customItems.length) return { ok: false, error: "ინვოისში მხოლოდ საიტის პროდუქტი ჩაიწერება" };
  // ინვოისზე ტელეფონი სავალდებულოა; მაღაზიაში მოსულ მყიდველზე — არა
  if (!store && input.customerPhone.length < 9) return { ok: false, error: "მიუთითე ტელეფონის ნომერი" };
  if (input.deliveryMethod === "COURIER") {
    if (!DELIVERY_CITIES.includes(input.deliveryCity)) return { ok: false, error: "აირჩიე ქალაქი" };
    if (!input.deliveryAddress) return { ok: false, error: "მიუთითე მიწოდების მისამართი" };
  }
  if (input.sendEmail && !input.customerEmail) return { ok: false, error: "ელფოსტაზე გასაგზავნად მიუთითე მყიდველის ელფოსტა" };

  // ერთი პროდუქტი ორ ხაზად — ერთად ითვლება
  const wanted = new Map<string, number>();
  for (const i of input.items) wanted.set(i.productId, (wanted.get(i.productId) ?? 0) + i.qty);

  const products = await db.product.findMany({ where: { id: { in: [...wanted.keys()] }, isActive: true } });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: { product: (typeof products)[number]; qty: number; unitPrice: number }[] = [];
  for (const [productId, qty] of wanted) {
    const p = byId.get(productId);
    if (!p) return { ok: false, error: "არჩეული პროდუქტი საიტზე აღარ არის — წაშალე სიიდან" };
    if (!(p.price > 0)) return { ok: false, error: `„${p.nameKa}“ — ფასი არ აწერია; ჩაწერე „სხვა ნივთად“ ან ჯერ ფასი დაადე` };
    if (!isPurchasable(p)) return { ok: false, error: `„${p.nameKa}“ არ არის მარაგში` };
    if (p.stockStatus === "IN_STOCK" && qty > availableQty(p))
      return { ok: false, error: `„${p.nameKa}“ — ხელმისაწვდომია მხოლოდ ${availableQty(p)} ცალი` };
    if (normalizeQty(qty, p) !== qty)
      return {
        ok: false,
        error: p.qtyStep > 1
          ? `„${p.nameKa}“ — იყიდება მხოლოდ შეკვრით, ${p.qtyStep} ${p.unit ?? "ცალი"}`
          : `„${p.nameKa}“ — მინიმალური რაოდენობა ${p.minQty} ${p.unit ?? "ცალი"}`,
      };
    // საცალო ფასი — ისე, როგორც დაურეგისტრირებელ მყიდველს უჩანს საიტზე
    lines.push({ product: p, qty, unitPrice: effectivePrice(p, null).value });
  }

  const custom = input.customItems.map((c) => ({ ...c, price: Math.round(c.price * 100) / 100 }));
  const subtotal = Number(
    (lines.reduce((s, l) => s + l.unitPrice * l.qty, 0) + custom.reduce((s, c) => s + c.price * c.qty, 0)).toFixed(2)
  );
  const deliveryFee = deliveryFeeFor(input.deliveryMethod, input.deliveryCity, subtotal);
  const total = Number((subtotal + deliveryFee).toFixed(2));
  const courier = input.deliveryMethod === "COURIER";
  // მაღაზიაში — ტერმინალით ადგილზე; ინვოისი — გადარიცხვით. ორივეზე ჯავშანი 3 დღეა
  const paymentMethod = store ? "POS" : "BANK_TRANSFER";
  const note = store ? `მაღაზიის გაყიდვა მოამზადა: ${staff.name}` : `ინვოისი გამოწერა: ${staff.name} (ადმინ პანელი)`;

  let order;
  try {
    order = await db.$transaction(async (tx) => {
      // მარაგში მყოფი ხაზი ნაშთს იკავებს — იგივე წესით, რაც საიტის შეკვეთაზე
      const reserved = new Map<string, number>();
      for (const l of lines) {
        if (l.product.stockStatus !== "IN_STOCK") continue;
        if (!(await reserveStock(tx, l.product.id, l.qty)))
          throw new StaffOrderError(`„${l.product.nameKa}“ ამ წუთას სხვამ დაიკავა — შეამცირე რაოდენობა`);
        reserved.set(l.product.id, l.qty);
      }
      return tx.order.create({
        data: {
          number: await orderNumber(tx),
          userId: null,
          channel: store ? "STORE" : "STAFF_INVOICE",
          staffName: staff.name,
          reservedUntil: reservationDeadline(paymentMethod),
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerEmail: input.customerEmail,
          customerId: input.customerId || null,
          companyName: input.companyName || null,
          deliveryMethod: input.deliveryMethod,
          deliveryCity: courier ? input.deliveryCity : null,
          deliveryAddress: courier ? input.deliveryAddress : null,
          // ვინ მოამზადა — ადმინის შეკვეთის გვერდზე და გაყიდვების წერილში ჩანს, მყიდველის ინვოისზე არა
          comment: [`${INTERNAL_NOTE}${note}`, input.comment].filter(Boolean).join("\n"),
          subtotal,
          deliveryFee,
          total,
          paymentMethod,
          items: {
            create: [
              ...lines.map((l) => ({
                productId: l.product.id,
                sku: l.product.sku,
                name: l.product.nameKa,
                price: l.unitPrice,
                qty: l.qty,
                reservedQty: reserved.get(l.product.id) ?? 0,
                warrantyMonths: l.product.warrantyMonths,
              })),
              // საიტზე არარსებული ნივთი: პროდუქტს არ ებმება, ნაშთს არ ეხება
              ...custom.map((c) => ({ productId: null, sku: "—", name: c.name, price: c.price, qty: c.qty, reservedQty: 0 })),
            ],
          },
        },
      });
    });
  } catch (e) {
    if (e instanceof StaffOrderError) return { ok: false, error: e.message };
    console.error("თანამშრომლის შეკვეთა ვერ შეიქმნა", e);
    return { ok: false, error: "ვერ შეინახა — სცადე თავიდან" };
  }

  // ინვოისი: ნომერი ყოველთვის; წერილი — მხოლოდ თუ თანამშრომელმა მონიშნა. მაღაზიის გაყიდვას ინვოისი არ აქვს
  let invoiceNumber: string | null = null;
  let emailed = false;
  let emailError: string | undefined;
  if (!store) {
    try {
      const inv = await issueAndSendInvoice(order.id, { send: input.sendEmail });
      invoiceNumber = inv.invoiceNumber ?? null;
      emailed = input.sendEmail && inv.ok;
      if (input.sendEmail && !inv.ok) emailError = inv.error;
    } catch (e) {
      console.error("ინვოისი ვერ გამოიწერა", e);
      emailError = "ინვოისის ნომერი ვერ მიენიჭა";
    }
    try {
      await notifySalesNewOrder(order.id);
    } catch (e) {
      console.error("გაყიდვების შეტყობინება ჩავარდა", e);
    }
  }

  return { ok: true, orderId: order.id, number: order.number, invoiceNumber, emailed, emailError };
}

/** ძველი სახელი — ინვოისის გვერდი */
export const createStaffInvoice = createStaffOrder;

export type StoreSaleResult = { ok: true } | { ok: false; error: string };

/**
 * „გაიყიდა“ — მაღაზიის გაყიდვის დადასტურება ფულის მიღების შემდეგ. ნაშთი ჩამოიწერება (ჯერ ჩვენი
 * საწყობი, მერე მიმწოდებლისა), გატანაზე შეკვეთა მაშინვე დასრულებულია.
 */
export async function markStoreSold(orderId: string): Promise<StoreSaleResult> {
  const o = await db.order.findUnique({
    where: { id: orderId },
    select: { channel: true, status: true, paymentStatus: true, deliveryMethod: true },
  });
  if (!o || o.channel !== "STORE") return { ok: false, error: "მაღაზიის გაყიდვა ვერ მოიძებნა" };
  if (o.paymentStatus === "PAID") return { ok: true }; // ორჯერ დაჭერა — არაფერი იცვლება
  // ვადაგასულს ჯავშანი მოხსნილი აქვს — ნივთი შეიძლება უკვე სხვას მიჰყიდა; თავიდან უნდა მომზადდეს
  if (o.status !== "PENDING") return { ok: false, error: "ეს გაყიდვა გაუქმებულია ან ვადა გაუვიდა — მოამზადე თავიდან" };

  await markOrderPaid(orderId, undefined, { notify: true });
  if (o.deliveryMethod === "PICKUP") {
    await db.order.updateMany({ where: { id: orderId, status: "PAID" }, data: { status: "DELIVERED" } });
  }
  return { ok: true };
}

/** მომზადებული (გადაუხდელი) მაღაზიის გაყიდვის გაუქმება — ჯავშანი იხსნება */
export async function cancelStoreSale(orderId: string): Promise<StoreSaleResult> {
  const o = await db.order.findUnique({ where: { id: orderId }, select: { channel: true, paymentStatus: true } });
  if (!o || o.channel !== "STORE") return { ok: false, error: "მაღაზიის გაყიდვა ვერ მოიძებნა" };
  if (o.paymentStatus === "PAID") return { ok: false, error: "გაყიდული ჩანაწერი აქედან არ უქმდება — მიმართე ადმინს" };
  await cancelOrder(orderId);
  return { ok: true };
}
