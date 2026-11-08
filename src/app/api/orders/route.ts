import { NextResponse, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isPurchasable, availableQty, normalizeQty } from "@/lib/stock";
import { reservationDeadline, reserveStock } from "@/lib/orders";
import { orderNumber } from "@/lib/sequence";
import { createPayment, isBogEnabled } from "@/lib/payments/bog";
import { canPayWithTbc, createFlittPayment } from "@/lib/payments/flitt";
import { getI18n } from "@/lib/i18n/server";
import { nameOf } from "@/lib/i18n/content";
import { FREE_DELIVERY_FROM, PAYMENT_TTL_MINUTES } from "@/lib/constants";
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
  // განვადება ცალკე მეთოდად აღარ არის — ბანკის გადახდის გვერდზეა (ძველი შეკვეთები INSTALLMENT-ით რჩება)
  paymentMethod: z.enum(["BOG", "TBC", "BANK_TRANSFER", "POS"]),
  organizationId: z.string().optional(),
  items: z
    .array(z.object({ productId: z.string(), qty: z.number().int().min(1).max(100000) }))
    .min(1, "კალათა ცარიელია")
    .max(200, "კალათაში ძალიან ბევრი პოზიციაა"),
});

/** ჩვენი, მყიდველისთვის განკუთვნილი შეცდომა — დანარჩენი (ბაზის ტექსტი) გარეთ არ გადის */
class OrderError extends Error {}

/** ერთ მომხმარებელს ერთდროულად ამდენი გადაუხდელი შეკვეთა — მეტით ნაშთს „იპყრობდა“ */
const MAX_OPEN_ORDERS = 3;

export async function POST(req: Request) {
  // შეცდომა მყიდველის ენაზე — ენა checkout-ის გვერდიდან (referer) მოდის
  const { locale, t } = await getI18n();
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: t("არავალიდური მოთხოვნა") }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t(parsed.error.issues[0]?.message ?? "ვალიდაციის შეცდომა") },
      { status: 400 }
    );
  }
  const input = parsed.data;

  if (input.paymentMethod === "BOG" && !isBogEnabled()) {
    return NextResponse.json({ error: t("ბარათით გადახდა დროებით მიუწვდომელია") }, { status: 400 });
  }
  if (input.paymentMethod === "TBC" && !(await canPayWithTbc())) {
    return NextResponse.json({ error: t("თიბისის ბარათით გადახდა დროებით მიუწვდომელია") }, { status: 400 });
  }

  if (input.deliveryMethod === "COURIER" && !input.deliveryAddress?.trim()) {
    return NextResponse.json({ error: t("მიუთითეთ მიწოდების მისამართი") }, { status: 400 });
  }

  // შეკვეთა მხოლოდ დარეგისტრირებულს — კალათა ბრაუზერში რჩება, კლიენტი შესვლაზე გადადის
  const viewer = await getCurrentUser();
  if (!viewer) {
    return NextResponse.json(
      { error: t("შეკვეთის გასაფორმებლად გაიარე რეგისტრაცია ან შედი ანგარიშში"), requireLogin: true },
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
      { error: t("ძალიან ბევრი შეკვეთა ერთბაშად — {0}", retryText(sec, t)) },
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
        { error: t("კალათაში არსებული პროდუქტი აღარ არის ხელმისაწვდომი") },
        { status: 409 }
      );
    }
    // ფასის გარეშე პოზიცია („ფასი მოთხოვნით“) ონლაინ არ იყიდება
    if (!(p.price > 0)) {
      return NextResponse.json({ error: t("„{0}“ — ფასი მოთხოვნით, დაგვიკავშირდით", nameOf(p, locale)) }, { status: 409 });
    }
    if (!isPurchasable(p)) {
      return NextResponse.json({ error: t("„{0}“ არ არის მარაგში", nameOf(p, locale)) }, { status: 409 });
    }
    if (p.stockStatus === "IN_STOCK" && item.qty > availableQty(p)) {
      return NextResponse.json(
        { error: t("„{0}“ — ხელმისაწვდომია მხოლოდ {1} ცალი", nameOf(p, locale), availableQty(p)) },
        { status: 409 }
      );
    }
    // წესს ბრაუზერს არ ვანდობთ: ძველი კალათა ან ხელით გაგზავნილი მოთხოვნა გვერდს აუვლიდა
    if (normalizeQty(item.qty, p) !== item.qty) {
      const unit = p.unit ? t(p.unit) : "";
      return NextResponse.json(
        {
          error: p.qtyStep > 1
            ? t("„{0}“ — იყიდება მხოლოდ შეკვრით, {1} {2}", nameOf(p, locale), p.qtyStep, unit)
            : t("„{0}“ — მინიმალური რაოდენობა {1} {2}", nameOf(p, locale), p.minQty, unit),
        },
        { status: 409 }
      );
    }
    lines.push({ product: p, qty: item.qty });
  }

  const open = await db.order.count({
    where: { userId: viewer.id, status: "PENDING", paymentStatus: { not: "PAID" }, reservedUntil: { gt: new Date() } },
  });
  if (open >= MAX_OPEN_ORDERS) {
    return NextResponse.json(
      { error: t("გაქვს {0} გადაუხდელი შეკვეთა — ჯერ ისინი გადაიხადე ან დაელოდე ვადის გასვლას", open) },
      { status: 429 }
    );
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
      return NextResponse.json({ error: t("ორგანიზაცია ვერ მოიძებნა") }, { status: 400 });
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
    // მარაგში მყოფი ხაზი ნაშთს იკავებს; შემოწმება და დაკავება ერთ SQL-შია — ორი მყიდველი
    // ბოლო ცალს ერთდროულად ვეღარ დაიკავებს. წინასწარი შეკვეთა / გზაში — არაფერს იკავებს.
    const reserved = new Map<string, number>();
    for (const l of priced) {
      if (l.product.stockStatus !== "IN_STOCK") continue;
      if (!(await reserveStock(tx, l.product.id, l.qty))) {
        throw new OrderError(t("„{0}“ ამ წუთას სხვამ დაიკავა — შეამცირე რაოდენობა", nameOf(l.product, locale)));
      }
      reserved.set(l.product.id, (reserved.get(l.product.id) ?? 0) + l.qty);
    }

    return tx.order.create({
    data: {
      number: await orderNumber(tx),
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
          reservedQty: takeReserved(reserved, l.product.id, l.qty),
          warrantyMonths: l.product.warrantyMonths,
        })),
      },
    },
    });
  }).catch((e: unknown) => {
    if (e instanceof OrderError) return { error: e.message } as const;
    console.error("შეკვეთის შექმნა ჩავარდა", e);
    return { error: t("შეკვეთის შექმნა ვერ მოხერხდა — სცადე თავიდან") } as const;
  });

  if ("error" in order) {
    return NextResponse.json({ error: order.error }, { status: 409 });
  }

  // წერილები პასუხის შემდეგ — ფოსტის სერვერი რომ დააგვიანოს, მყიდველი ბანკზე მაინც მაშინვე გადადის
  const paymentMethod = input.paymentMethod;
  after(async () => {
    // საბანკო გადარიცხვაზე ინვოისი მაშინვე გამოიწერება და ელფოსტაზე მიდის
    if (paymentMethod === "BANK_TRANSFER") {
      try {
        const invoice = await issueAndSendInvoice(order.id);
        if (!invoice.ok) console.error("ინვოისი ვერ გაიგზავნა", invoice.error);
      } catch (e) {
        console.error("ინვოისი ვერ გამოიწერა", e);
      }
    }
    // გაყიდვებს ყოველ შეკვეთაზე — ინვოისის ნომერი უკვე მინიჭებულია, წერილში ჩაჯდება
    try {
      await notifySalesNewOrder(order.id);
    } catch (e) {
      console.error("გაყიდვების შეტყობინება ჩავარდა", e);
    }
  });

  // გადარიცხვა / POS — ბანკზე გადამისამართება არ ხდება
  if (input.paymentMethod !== "BOG" && input.paymentMethod !== "TBC") {
    return NextResponse.json({ orderId: order.id, redirectUrl: `/order/${order.id}` });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;

  try {
    const request = {
      orderId: order.id,
      orderNumber: order.number,
      amount: total,
      deliveryFee,
      ttlMinutes: PAYMENT_TTL_MINUTES,
      buyer: { name: input.customerName, email: input.customerEmail, phone: input.customerPhone },
      siteUrl,
      locale,
      items: priced.map((l) => ({
        productId: l.product.id,
        name: l.product.nameKa,
        qty: l.qty,
        price: l.unitPrice,
      })),
    };
    const payment =
      input.paymentMethod === "TBC"
        ? await createFlittPayment({ ...request, lang: locale })
        : await createPayment(request);

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

/** ერთი პროდუქტი კალათაში ორ ხაზად თუ მოვიდა — დაკავებული რაოდენობა ხაზებზე ნაწილდება */
function takeReserved(reserved: Map<string, number>, productId: string, qty: number): number {
  const left = reserved.get(productId) ?? 0;
  const take = Math.min(left, qty);
  reserved.set(productId, left - take);
  return take;
}
