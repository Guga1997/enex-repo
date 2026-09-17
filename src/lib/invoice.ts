import { db } from "./db";
import { gel, formatDate } from "./format";
import { sendEmail } from "./notify/email";
import { DELIVERY_METHOD_LABELS, PAYMENT_METHOD_LABELS } from "./constants";

/**
 * გამყიდველის რეკვიზიტები ინვოისისთვის.
 * .env-ში ჩაწერე — ამ მნიშვნელობებით ინვოისი გამოვა, მაგრამ გადახდას ვერავინ შეასრულებს.
 */
export const SELLER = {
  name: process.env.SELLER_NAME || "შპს [დასახელება]",
  taxId: process.env.SELLER_TAX_ID || "[საიდენტიფიკაციო კოდი]",
  address: process.env.SELLER_ADDRESS || "[მისამართი]",
  phone: process.env.SELLER_PHONE || "",
  email: process.env.SELLER_EMAIL || process.env.MAIL_FROM || "",
  bankName: process.env.SELLER_BANK_NAME || "[ბანკის დასახელება]",
  bankCode: process.env.SELLER_BANK_CODE || "",
  iban: process.env.SELLER_IBAN || "[ანგარიშის ნომერი]",
};

/** რეკვიზიტები შევსებულია თუ ჩანაცვლების ნიშნები დარჩა */
export const sellerIsConfigured = () =>
  !SELLER.name.includes("[") && !SELLER.iban.includes("[") && !SELLER.taxId.includes("[");

/** INV-2026-00001 — შეკვეთის ნომრისგან დამოუკიდებელი, თანმიმდევრული ნუმერაცია */
export async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.order.count({ where: { invoiceNumber: { not: null } } });
  return `INV-${year}-${String(count + 1).padStart(5, "0")}`;
}

type InvoiceOrder = {
  number: string;
  invoiceNumber: string | null;
  createdAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerId: string | null;
  companyName: string | null;
  deliveryMethod: string;
  /** არ არის ან BANK_TRANSFER — საბანკო რეკვიზიტებით; სხვა — გადახდის მეთოდი იწერება რეკვიზიტების ნაცვლად */
  paymentMethod?: string;
  comment?: string | null;
  deliveryCity: string | null;
  deliveryAddress: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  items: { sku: string; name: string; price: number; qty: number }[];
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** ინვოისი ერთ HTML-ად — ბეჭდვაც შეიძლება და ელფოსტაშიც ისე ჩანს, როგორც არის */
export function buildInvoiceHtml(order: InvoiceOrder): string {
  const buyer = order.companyName || order.customerName;
  const dueDate = new Date(order.createdAt.getTime() + 3 * 86_400_000);
  // გადარიცხვაზე ბანკის რეკვიზიტები სჭირდება; ტერმინალზე/ბარათზე — არა, იქ მეთოდი კმარა
  const bankTransfer = !order.paymentMethod || order.paymentMethod === "BANK_TRANSFER";

  const rows = order.items
    .map(
      (it, i) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${i + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">
          ${esc(it.name)}<br><span style="color:#6b7480;font-size:12px">#${esc(it.sku)}</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${it.qty}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${gel(it.price)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">
          ${gel(Math.round(it.price * it.qty * 100) / 100)}
        </td>
      </tr>`
    )
    .join("");

  const deliveryRow =
    order.deliveryFee > 0
      ? `<tr><td colspan="4" style="padding:6px 10px;text-align:right;color:#6b7480">მიწოდება</td>
         <td style="padding:6px 10px;text-align:right">${gel(order.deliveryFee)}</td></tr>`
      : "";

  const shipTo =
    order.deliveryMethod === "COURIER"
      ? `${esc(order.deliveryCity ? order.deliveryCity + ", " : "")}${esc(order.deliveryAddress ?? "")}`
      : "საწყობიდან გატანა";

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

  return `<!doctype html>
<html lang="ka"><head><meta charset="utf-8">
<title>ინვოისი ${esc(order.invoiceNumber ?? order.number)}</title></head>
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:'Noto Sans Georgian',system-ui,sans-serif;color:#14181d">
<div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:28px">

  <div style="padding-bottom:18px;margin-bottom:20px;border-bottom:2px solid #009cd1">
    <img src="${siteUrl}/brand/enex-logo-email.png" alt="Enex" width="180" style="display:block;height:auto">
  </div>

  <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap">
    <div>
      <div style="font-size:22px;font-weight:700">ინვოისი</div>
      <div style="color:#6b7480;font-size:14px;margin-top:4px">
        № ${esc(order.invoiceNumber ?? "—")} · შეკვეთა ${esc(order.number)}
      </div>
    </div>
    <div style="text-align:right;font-size:13px;color:#6b7480">
      გამოწერის თარიღი: ${formatDate(order.createdAt)}${
        bankTransfer ? "<br>გადახდის ვადა: " + formatDate(dueDate) : ""
      }
    </div>
  </div>

  <table style="width:100%;margin-top:24px;font-size:13px;border-collapse:collapse">
    <tr>
      <td style="vertical-align:top;width:50%;padding-right:12px">
        <div style="color:#6b7480;margin-bottom:6px">გამყიდველი</div>
        <div style="font-weight:600">${esc(SELLER.name)}</div>
        <div style="color:#6b7480;line-height:1.7">
          ს/კ ${esc(SELLER.taxId)}<br>
          ${esc(SELLER.address)}<br>
          ${SELLER.phone ? esc(SELLER.phone) + "<br>" : ""}
          ${SELLER.email ? esc(SELLER.email) : ""}
        </div>
      </td>
      <td style="vertical-align:top;width:50%">
        <div style="color:#6b7480;margin-bottom:6px">მყიდველი</div>
        <div style="font-weight:600">${esc(buyer)}</div>
        <div style="color:#6b7480;line-height:1.7">
          ${order.customerId ? "ს/კ " + esc(order.customerId) + "<br>" : ""}
          ${esc(order.customerEmail)}<br>
          ${esc(order.customerPhone)}
        </div>
      </td>
    </tr>
  </table>

  <table style="width:100%;margin-top:24px;border-collapse:collapse;font-size:13px">
    <thead>
      <tr style="background:#f6f7f9;text-align:left;color:#6b7480">
        <th style="padding:8px 10px;width:32px">#</th>
        <th style="padding:8px 10px">დასახელება</th>
        <th style="padding:8px 10px;text-align:right;width:60px">რაოდ.</th>
        <th style="padding:8px 10px;text-align:right;width:100px">ფასი</th>
        <th style="padding:8px 10px;text-align:right;width:110px">ჯამი</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      ${deliveryRow}
      <tr>
        <td colspan="4" style="padding:12px 10px;text-align:right;font-weight:700">გადასახდელი</td>
        <td style="padding:12px 10px;text-align:right;font-weight:700;font-size:16px;color:#009cd1">
          ${gel(order.total)}
        </td>
      </tr>
    </tfoot>
  </table>

  <div style="margin-top:24px;padding:16px;background:#f6f7f9;border-radius:8px;font-size:13px;line-height:1.8">
    ${
      bankTransfer
        ? `<div style="font-weight:600;margin-bottom:6px">გადახდის რეკვიზიტები</div>
    ${esc(SELLER.bankName)}${SELLER.bankCode ? " · " + esc(SELLER.bankCode) : ""}<br>
    ანგარიში: <b>${esc(SELLER.iban)}</b><br>
    მიმღები: ${esc(SELLER.name)}<br>
    <span style="color:#6b7480">დანიშნულებაში მიუთითე: ${esc(order.invoiceNumber ?? order.number)}</span>`
        : `<div style="font-weight:600;margin-bottom:6px">გადახდა</div>
    ${esc(PAYMENT_METHOD_LABELS[order.paymentMethod!] ?? order.paymentMethod!)}`
    }
  </div>

  <div style="margin-top:16px;font-size:13px;color:#6b7480;line-height:1.8">
    მიწოდება: ${esc(DELIVERY_METHOD_LABELS[order.deliveryMethod] ?? order.deliveryMethod)}${
      shipTo ? " — " + shipTo : ""
    }<br>
    ${order.comment ? "კომენტარი: " + esc(order.comment) + "<br>" : ""}
    ${bankTransfer ? "თანხის ჩარიცხვის შემდეგ შეკვეთა ავტომატურად გადავა დამუშავებაში." : ""}
  </div>

</div>
</body></html>`;
}

/**
 * ინვოისის გამოწერა და გაგზავნა რეგისტრაციის ელფოსტაზე.
 * ნომერს ერთხელ ვანიჭებთ — ხელახლა გაგზავნა იმავე ინვოისს აგზავნის.
 */
export async function issueAndSendInvoice(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { ok: false as const, error: "შეკვეთა ვერ მოიძებნა" };

  const invoiceNumber = order.invoiceNumber ?? (await nextInvoiceNumber());
  const html = buildInvoiceHtml({ ...order, invoiceNumber });

  const res = await sendEmail({
    to: order.customerEmail,
    subject: `ინვოისი ${invoiceNumber} — შეკვეთა ${order.number}`,
    html,
    text:
      `შეკვეთა ${order.number}, გადასახდელი ${gel(order.total)}. ` +
      `ანგარიში: ${SELLER.iban}. დანიშნულებაში მიუთითე ${invoiceNumber}.`,
  });

  await db.order.update({
    where: { id: orderId },
    data: { invoiceNumber, invoiceSentAt: res.ok ? new Date() : null },
  });

  return res.ok
    ? { ok: true as const, invoiceNumber }
    : { ok: false as const, error: res.error, invoiceNumber };
}
