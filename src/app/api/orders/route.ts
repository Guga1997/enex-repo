import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isPurchasable, availableQty } from "@/lib/stock";
import { reservationDeadline } from "@/lib/orders";
import { createPayment } from "@/lib/payments/bog";
import { FREE_DELIVERY_FROM, RESERVATION_MINUTES } from "@/lib/constants";
import { getCurrentUser } from "@/lib/customer-auth";
import { effectivePrice } from "@/lib/pricing";
import { issueAndSendInvoice } from "@/lib/invoice";
import { notifySalesNewOrder } from "@/lib/notify/sales";
import { rateLimit, clientIp, retryText, LIMITS } from "@/lib/rate-limit";

const schema = z.object({
  customerName: z.string().min(2, "მიუთითეთ სახელი და გვარი"),
  customerPhone: z.string().min(9, "მიუთითეთ ტელეფონის ნომერი"),
  customerEmail: z.string().email("არასწორი ელფოსტა"),
  customerId: z.string().optional(),
  companyName: z.string().optional(),
  deliveryMethod: z.enum(["COURIER", "PICKUP"]),
  deliveryCity: z.string().optional(),
  deliveryAddress: z.string().optional(),
  comment: z.string().max(1000).optional(),
  paymentMethod: z.enum(["BOG", "BANK_TRANSFER", "INSTALLMENT", "POS"]),
  organizationId: z.string().optional(),
  items: z
    .array(z.object({ productId: z.string(), qty: z.number().int().min(1).max(999) }))
    .min(1, "კალათა ცარიელია"),
});

async function nextOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.order.count();
  return `ORD-${year}-${String(count + 1).padStart(5, "0")}`;
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "არავალიდური მოთხოვნა" }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "ვალიდაციის შეცდომა" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  if (input.deliveryMethod === "COURIER" && !input.deliveryAddress?.trim()) {
    return NextResponse.json({ error: "მიუთითეთ მიწოდების მისამართი" }, { status: 400 });
  }

  // შეკვეთა მხოლოდ დარეგისტრირებულს — კალათა ბრაუზერში რჩება, კლიენტი შესვლაზე გადადის
  const viewer = await getCurrentUser();
  if (!viewer) {
    return NextResponse.json(
      { error: "შეკვეთის გასაფორმებლად გაიარე რეგისტრაცია ან შედი ანგარიშში", requireLogin: true },
      { status: 401 }
    );
  }

  // შეკვეთა ნაშთს იკავებს — ბოტმა ამით კატალოგი არ უნდა დაბლოკოს
  const ip = await clientIp();
  const perUser = rateLimit(`order-u:${viewer.id}`, LIMITS.orderPerUser.limit, LIMITS.orderPerUser.windowMs);
  const perIp = rateLimit(`order-ip:${ip}`, LIMITS.orderPerIp.limit, LIMITS.orderPerIp.windowMs);
  if (!perUser.ok || !perIp.ok) {
    const sec = Math.max(perUser.ok ? 0 : perUser.retryAfterSec, perIp.ok ? 0 : perIp.retryAfterSec);
    return NextResponse.json(
      { error: `ძალიან ბევრი შეკვეთა ერთბაშად — ${retryText(sec)}` },
      { status: 429, headers: { "Retry-After": String(sec) } }
    );
  }

  // ფასებს და ნაშთს ყოველთვის სერვერიდან ვიღებთ — კლიენტის მონაცემებს არ ვენდობით
  const products = await db.product.findMany({
    where: { id: { in: input.items.map((i) => i.productId) }, isActive: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = [];
  for (const item of input.items) {
    const p = byId.get(item.productId);
    if (!p) {
      return NextResponse.json(
        { error: "კალათაში არსებული პროდუქტი აღარ არის ხელმისაწვდომი" },
        { status: 409 }
      );
    }
    if (!isPurchasable(p)) {
      return NextResponse.json({ error: `"${p.nameKa}" არ არის მარაგში` }, { status: 409 });
    }
    if (p.stockStatus === "IN_STOCK" && item.qty > availableQty(p)) {
      return NextResponse.json(
        { error: `"${p.nameKa}" — ხელმისაწვდომია მხოლოდ ${availableQty(p)} ცალი` },
        { status: 409 }
      );
    }
    lines.push({ product: p, qty: item.qty });
  }

  // ფასს მომხმარებლის დონის მიხედვით სერვერზე ვთვლით — კლიენტიდან მოსული ფასი იგნორირდება
  const priced = lines.map((l) => ({
    ...l,
    unitPrice: effectivePrice(l.product, viewer).value,
  }));

  // ორგანიზაცია მხოლოდ საკუთარი შეიძლება იყოს
  let organizationId: string | null = null;
  if (viewer && input.organizationId) {
    const org = await db.organization.findFirst({
      where: { id: input.organizationId, userId: viewer.id },
      select: { id: true },
    });
    if (!org) {
      return NextResponse.json({ error: "ორგანიზაცია ვერ მოიძებნა" }, { status: 400 });
    }
    organizationId = org.id;
  }

  const subtotal = Number(
    priced.reduce((s, l) => s + l.unitPrice * l.qty, 0).toFixed(2)
  );
  const deliveryFee =
    input.deliveryMethod === "PICKUP" || subtotal >= FREE_DELIVERY_FROM ? 0 : 15;
  const total = Number((subtotal + deliveryFee).toFixed(2));

  const order = await db.$transaction(async (tx) => {
    for (const l of priced) {
      if (l.product.stockStatus !== "IN_STOCK") continue;
      // ტრანზაქციაში ხელახლა ვამოწმებთ — წამის წინ სხვამ შეიძლება დაიკავა
      const fresh = await tx.product.findUnique({
        where: { id: l.product.id },
        select: { stockQty: true, reservedQty: true, nameKa: true },
      });
      if (!fresh || availableQty(fresh) < l.qty) {
        throw new Error(`"${fresh?.nameKa ?? l.product.nameKa}" ამ წუთას სხვამ დაიკავა — შეამცირე რაოდენობა`);
      }
      await tx.product.update({
        where: { id: l.product.id },
        data: { reservedQty: { increment: l.qty } },
      });
    }

    return tx.order.create({
    data: {
      number: await nextOrderNumber(),
      userId: viewer.id,
      organizationId,
      reservedUntil: reservationDeadline(input.paymentMethod),
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      customerId: input.customerId || null,
      companyName: input.companyName || null,
      deliveryMethod: input.deliveryMethod,
      deliveryCity: input.deliveryCity || null,
      deliveryAddress: input.deliveryAddress || null,
      comment: input.comment || null,
      subtotal,
      deliveryFee,
      total,
      paymentMethod: input.paymentMethod,
      items: {
        create: priced.map((l) => ({
          productId: l.product.id,
          sku: l.product.sku,
          name: l.product.nameKa,
          price: l.unitPrice,
          qty: l.qty,
          warrantyMonths: l.product.warrantyMonths,
        })),
      },
    },
    });
  }).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : "შეკვეთის შექმნა ვერ მოხერხდა";
    return { error: msg } as const;
  });

  if ("error" in order) {
    return NextResponse.json({ error: order.error }, { status: 409 });
  }

  // საბანკო გადარიცხვაზე ინვოისი მაშინვე გამოიწერება და ელფოსტაზე მიდის
  if (input.paymentMethod === "BANK_TRANSFER") {
    const invoice = await issueAndSendInvoice(order.id);
    if (!invoice.ok) console.error("ინვოისი ვერ გაიგზავნა", invoice.error);
  }

  // გაყიდვებს ყოველ შეკვეთაზე — ინვოისის ნომერი უკვე მინიჭებულია, წერილში ჩაჯდება
  try {
    await notifySalesNewOrder(order.id);
  } catch (e) {
    console.error("გაყიდვების შეტყობინება ჩავარდა", e);
  }

  // გადარიცხვა / განვადება / POS — ბანკზე გადამისამართება არ ხდება
  if (input.paymentMethod !== "BOG") {
    return NextResponse.json({ orderId: order.id, redirectUrl: `/order/${order.id}` });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;

  try {
    const payment = await createPayment({
      orderId: order.id,
      orderNumber: order.number,
      amount: total,
      deliveryFee,
      ttlMinutes: RESERVATION_MINUTES.BOG,
      buyer: { name: input.customerName, email: input.customerEmail, phone: input.customerPhone },
      siteUrl,
      items: priced.map((l) => ({
        productId: l.product.id,
        name: l.product.nameKa,
        qty: l.qty,
        price: l.unitPrice,
      })),
    });

    await db.order.update({
      where: { id: order.id },
      data: { paymentId: payment.paymentId },
    });

    return NextResponse.json({ orderId: order.id, redirectUrl: payment.redirectUrl });
  } catch (err) {
    console.error("payment init failed", err);
    // შეკვეთა შექმნილია — მომხმარებელს ვუშვებთ შეკვეთის გვერდზე ხელახლა ცდისთვის
    return NextResponse.json(
      { orderId: order.id, redirectUrl: `/order/${order.id}?payment_error=1` },
      { status: 200 }
    );
  }
}
