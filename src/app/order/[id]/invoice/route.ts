import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/customer-auth";
import { buildInvoiceHtml, issueAndSendInvoice } from "@/lib/invoice";

/**
 * ინვოისის გახსნა/ბეჭდვა შეკვეთის გვერდიდან.
 * წვდომა: ან შეკვეთის მფლობელი ხარ, ან შეკვეთის id გაქვს — იგივე წესი,
 * რაც თვითონ შეკვეთის გვერდზეა (id შემთხვევით არ გამოიცნობა).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) {
    return new Response("შეკვეთა ვერ მოიძებნა", { status: 404 });
  }

  // სხვისი ანგარიშის შეკვეთას შესული მომხმარებელი ვერ გახსნის
  const viewer = await getCurrentUser();
  if (order.userId && viewer && order.userId !== viewer.id) {
    return new Response("წვდომა აკრძალულია", { status: 403 });
  }

  // ინვოისი მხოლოდ საბანკო გადარიცხვაზე გამოიწერება
  if (order.paymentMethod !== "BANK_TRANSFER") {
    return new Response("ამ შეკვეთაზე ინვოისი არ გამოწერილა", { status: 404 });
  }

  let invoiceNumber = order.invoiceNumber;
  if (!invoiceNumber) {
    const issued = await issueAndSendInvoice(order.id);
    invoiceNumber = issued.invoiceNumber ?? null;
  }

  return new Response(buildInvoiceHtml({ ...order, invoiceNumber }), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
