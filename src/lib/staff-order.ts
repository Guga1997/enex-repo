import { z } from "zod";
import { db } from "./db";
import { DELIVERY_CITIES, deliveryFeeFor } from "./constants";
import { availableQty, isPurchasable, normalizeQty } from "./stock";
import { reservationDeadline, reserveStock } from "./orders";
import { orderNumber } from "./sequence";
import { effectivePrice } from "./pricing";
import { INTERNAL_NOTE, issueAndSendInvoice } from "./invoice";
import { notifySalesNewOrder } from "./notify/sales";

/**
 * თანამშრომლის (გაყიდვების) გამოწერილი ინვოისი: ჩვეულებრივი შეკვეთა საბანკო გადარიცხვით,
 * მყიდველის სახელზე. იგივე წესები, რაც საიტზე — ფასი საიტის საცალოა (თანამშრომელი ფასს
 * ვერ ცვლის), ნაშთი მოწმდება და იკავება, მიწოდების საფასური ქალაქით ითვლება.
 */
export const staffInvoiceSchema = z.object({
  customerName: z.string().trim().min(2, "მიუთითე მყიდველის სახელი და გვარი"),
  customerPhone: z.string().trim().min(9, "მიუთითე ტელეფონის ნომერი"),
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
    .min(1, "აირჩიე ერთი პროდუქტი მაინც")
    .max(200, "ძალიან ბევრი პოზიციაა"),
});
export type StaffInvoiceInput = z.input<typeof staffInvoiceSchema>;

class InvoiceError extends Error {}

export type StaffInvoiceResult =
  | { ok: true; orderId: string; number: string; invoiceNumber: string | null; emailed: boolean; emailError?: string }
  | { ok: false; error: string };

export async function createStaffInvoice(raw: unknown, staff: { name: string }): Promise<StaffInvoiceResult> {
  const parsed = staffInvoiceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "შეავსე ყველა ველი" };
  const input = parsed.data;

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
    if (!(p.price > 0)) return { ok: false, error: `„${p.nameKa}“ — ფასი არ აწერია, ინვოისში ვერ ჩაჯდება` };
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

  const subtotal = Number(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0).toFixed(2));
  const deliveryFee = deliveryFeeFor(input.deliveryMethod, input.deliveryCity, subtotal);
  const total = Number((subtotal + deliveryFee).toFixed(2));
  const courier = input.deliveryMethod === "COURIER";

  let order;
  try {
    order = await db.$transaction(async (tx) => {
      // მარაგში მყოფი ხაზი ნაშთს იკავებს — იგივე წესით, რაც საიტის შეკვეთაზე
      const reserved = new Map<string, number>();
      for (const l of lines) {
        if (l.product.stockStatus !== "IN_STOCK") continue;
        if (!(await reserveStock(tx, l.product.id, l.qty)))
          throw new InvoiceError(`„${l.product.nameKa}“ ამ წუთას სხვამ დაიკავა — შეამცირე რაოდენობა`);
        reserved.set(l.product.id, l.qty);
      }
      return tx.order.create({
        data: {
          number: await orderNumber(tx),
          userId: null,
          reservedUntil: reservationDeadline("BANK_TRANSFER"),
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerEmail: input.customerEmail,
          customerId: input.customerId || null,
          companyName: input.companyName || null,
          deliveryMethod: input.deliveryMethod,
          deliveryCity: courier ? input.deliveryCity : null,
          deliveryAddress: courier ? input.deliveryAddress : null,
          // ვინ გამოწერა — ადმინის შეკვეთის გვერდზე და გაყიდვების წერილში ჩანს, მყიდველის ინვოისზე არა
          comment: [`${INTERNAL_NOTE}ინვოისი გამოწერა: ${staff.name} (ადმინ პანელი)`, input.comment].filter(Boolean).join("\n"),
          subtotal,
          deliveryFee,
          total,
          paymentMethod: "BANK_TRANSFER",
          items: {
            create: lines.map((l) => ({
              productId: l.product.id,
              sku: l.product.sku,
              name: l.product.nameKa,
              price: l.unitPrice,
              qty: l.qty,
              reservedQty: reserved.get(l.product.id) ?? 0,
              warrantyMonths: l.product.warrantyMonths,
            })),
          },
        },
      });
    });
  } catch (e) {
    if (e instanceof InvoiceError) return { ok: false, error: e.message };
    console.error("ინვოისის შეკვეთა ვერ შეიქმნა", e);
    return { ok: false, error: "ინვოისი ვერ შეიქმნა — სცადე თავიდან" };
  }

  // ნომერი ყოველთვის; წერილი — მხოლოდ თუ თანამშრომელმა მონიშნა
  let invoiceNumber: string | null = null;
  let emailed = false;
  let emailError: string | undefined;
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

  return { ok: true, orderId: order.id, number: order.number, invoiceNumber, emailed, emailError };
}
