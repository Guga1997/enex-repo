import { db } from "../db";
import { gel } from "../format";
import { buildInvoiceHtml } from "../invoice";
import { DELIVERY_METHOD_LABELS, PAYMENT_METHOD_LABELS } from "../constants";
import { sendEmail } from "./email";
import { sendSms } from "./sms";

/**
 * შეტყობინებები გაყიდვების განყოფილებას — ახალი შეკვეთა და გადახდა.
 *
 *   SALES_EMAIL  — ვის მივიდეს (რამდენიმე მძიმით). ცარიელი → არაფერი იგზავნება.
 *   SALES_PHONE  — არასავალდებულო: მოკლე SMS ყოველ ახალ შეკვეთაზე. ყოველი SMS ფასიანია.
 *
 * ყოველ წერილს ერთვის შეკვეთის ფურცელი (იგივე ინვოისი): გადარიცხვაზე ბანკის
 * რეკვიზიტებით, დანარჩენზე — გადახდის მეთოდით. ასე მენეჯერს ბეჭდვისთვის ყველაფერი აქვს.
 *
 * ჩავარდნა შეკვეთას არ აჩერებს — მყიდველი ჩვენი ფოსტის პრობლემას ვერ უნდა ხედავდეს.
 */

const recipients = () =>
  (process.env.SALES_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

type OrderWithItems = NonNullable<
  Awaited<ReturnType<typeof db.order.findUnique<{ where: { id: string }; include: { items: true } }>>>
>;

function summaryHtml(order: OrderWithItems, headline: string, note: string) {
  const rows = order.items
    .map(
      (it) =>
        `<tr><td style="padding:4px 8px">${esc(it.name)}<br><span style="color:#6b7480;font-size:12px">#${esc(it.sku)}</span></td>` +
        `<td style="padding:4px 8px;text-align:right">${it.qty}</td>` +
        `<td style="padding:4px 8px;text-align:right">${gel(it.price * it.qty)}</td></tr>`
    )
    .join("");

  const address =
    order.deliveryMethod === "COURIER"
      ? `${order.deliveryCity ? order.deliveryCity + ", " : ""}${order.deliveryAddress ?? ""}`
      : "";

  return `<div style="font-family:'Noto Sans Georgian',system-ui,sans-serif;font-size:14px;color:#14181d;max-width:640px">
  <h2 style="margin:0 0 4px;font-size:18px">${esc(headline)}</h2>
  ${note ? `<p style="margin:0 0 14px;padding:10px 12px;background:#fff7e6;border-left:3px solid #f59e0b">${esc(note)}</p>` : ""}
  <table style="border-collapse:collapse;font-size:14px;margin-bottom:14px">
    <tr><td style="padding:2px 8px 2px 0;color:#6b7480">შეკვეთა</td><td><b>${esc(order.number)}</b>${order.invoiceNumber ? " · ინვოისი " + esc(order.invoiceNumber) : ""}</td></tr>
    <tr><td style="padding:2px 8px 2px 0;color:#6b7480">მყიდველი</td><td>${esc(order.companyName ? `${order.companyName} (${order.customerName})` : order.customerName)}${order.customerId ? ", ს/კ " + esc(order.customerId) : ""}</td></tr>
    <tr><td style="padding:2px 8px 2px 0;color:#6b7480">კონტაქტი</td><td>${esc(order.customerPhone)} · ${esc(order.customerEmail)}</td></tr>
    <tr><td style="padding:2px 8px 2px 0;color:#6b7480">გადახდა</td><td>${esc(PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod)}</td></tr>
    <tr><td style="padding:2px 8px 2px 0;color:#6b7480">მიწოდება</td><td>${esc(DELIVERY_METHOD_LABELS[order.deliveryMethod] ?? order.deliveryMethod)}${address ? " — " + esc(address) : ""}</td></tr>
    ${order.comment ? `<tr><td style="padding:2px 8px 2px 0;color:#6b7480">კომენტარი</td><td>${esc(order.comment)}</td></tr>` : ""}
  </table>
  <table style="border-collapse:collapse;width:100%;font-size:13px;border-top:1px solid #e5e7eb">
    ${rows}
    <tr><td colspan="2" style="padding:8px;text-align:right;font-weight:700;border-top:1px solid #e5e7eb">სულ${order.deliveryFee ? " (მიწოდებით)" : ""}</td>
        <td style="padding:8px;text-align:right;font-weight:700;border-top:1px solid #e5e7eb">${gel(order.total)}</td></tr>
  </table>
  <p style="margin-top:16px"><a href="${siteUrl()}/admin/orders/${order.id}" style="color:#009cd1">გახსენი ადმინ პანელში →</a></p>
</div>`;
}

/** რა უნდა იცოდეს მენეჯერმა პირველ რიგში — გადახდისა და მიწოდების კომბინაციიდან */
function noteFor(order: OrderWithItems): string {
  const pickup = order.deliveryMethod === "PICKUP";
  switch (order.paymentMethod) {
    case "BANK_TRANSFER":
      return `ინვოისი მყიდველს გაეგზავნა. შეკვეთა დამუშავებაში ჩარიცხვის შემდეგ გადადის — ბანკში შეამოწმე.${pickup ? " მყიდველი თვითონ გაიტანს." : ""}`;
    case "POS":
      return `მყიდველი გადაიხდის ტერმინალით ${pickup ? "საწყობში გატანისას" : "მიტანისას"} — ${gel(order.total)}. მოამზადე შეკვეთა.`;
    case "INSTALLMENT":
      return "განვადება — დაუკავშირდი მყიდველს ბანკის განაცხადისთვის.";
    default:
      return pickup
        ? "ონლაინ გადახდა მიმდინარეობს. გადახდის დადასტურებაზე ცალკე წერილი მოვა; მყიდველი თვითონ გაიტანს."
        : "ონლაინ გადახდა მიმდინარეობს. გადახდის დადასტურებაზე ცალკე წერილი მოვა.";
  }
}

async function load(orderId: string) {
  return db.order.findUnique({ where: { id: orderId }, include: { items: true } });
}

/** ახალი შეკვეთა შეიქმნა — მაშინვე, გადახდამდე */
export async function notifySalesNewOrder(orderId: string): Promise<void> {
  const to = recipients();
  const order = await load(orderId);
  if (!order) return;

  const pay = PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod;
  const del = DELIVERY_METHOD_LABELS[order.deliveryMethod] ?? order.deliveryMethod;

  if (to.length) {
    const sheet = buildInvoiceHtml(order);
    const html = summaryHtml(order, `ახალი შეკვეთა ${order.number} — ${gel(order.total)}`, noteFor(order));
    await Promise.all(
      to.map((addr) =>
        sendEmail({
          to: addr,
          subject: `ახალი შეკვეთა ${order.number} — ${gel(order.total)} · ${pay} · ${del}`,
          html,
          text: `შეკვეთა ${order.number}, ${gel(order.total)}. ${pay}, ${del}. ${order.customerName} ${order.customerPhone}`,
          attachments: [
            { filename: `${order.invoiceNumber ?? order.number}.html`, content: sheet, contentType: "text/html" },
          ],
        }).then((r) => { if (!r.ok) console.error("გაყიდვების წერილი ვერ გაიგზავნა", addr, r.error); })
      )
    );
  }

  if (process.env.SALES_PHONE) {
    const r = await sendSms(
      process.env.SALES_PHONE,
      `Enex: ახალი შეკვეთა ${order.number}, ${gel(order.total)}, ${pay}, ${del}. ${order.customerPhone}`
    );
    if (!r.ok) console.error("გაყიდვების SMS ვერ გაიგზავნა", r.error);
  }
}

/** გადახდა დადასტურდა — ბანკის callback-იდან ან ადმინიდან */
export async function notifySalesPaid(orderId: string): Promise<void> {
  const to = recipients();
  if (!to.length) return;
  const order = await load(orderId);
  if (!order) return;

  const pay = PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod;
  const pickup = order.deliveryMethod === "PICKUP";
  const html = summaryHtml(
    order,
    `გადახდილია — შეკვეთა ${order.number}, ${gel(order.total)}`,
    pickup ? "თანხა ჩამოვიდა. მოამზადე შეკვეთა გასატანად." : "თანხა ჩამოვიდა. მოამზადე შეკვეთა მიწოდებისთვის."
  );
  await Promise.all(
    to.map((addr) =>
      sendEmail({
        to: addr,
        subject: `გადახდილია: შეკვეთა ${order.number} — ${gel(order.total)} · ${pay}`,
        html,
        text: `შეკვეთა ${order.number} გადახდილია, ${gel(order.total)}, ${pay}.`,
      }).then((r) => { if (!r.ok) console.error("გაყიდვების წერილი ვერ გაიგზავნა", addr, r.error); })
    )
  );
}
