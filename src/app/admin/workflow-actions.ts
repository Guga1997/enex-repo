"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { markOrderPaid } from "@/lib/orders";
import { canDo, isOpen, stepDef, type Step } from "@/lib/workflow";

/**
 * შეკვეთის პროცესის მოქმედებები.
 *
 * ყოველი ნაბიჯი ორჯერ მოწმდება: ინტერფეისში ღილაკი საერთოდ არ ჩანს, სერვერზე კი
 * ისევ ისმება კითხვა — ვინ ხარ და ღიაა თუ არა ეს ნაბიჯი. ასე ბრაუზერიდან
 * „ხელით“ გაგზავნილი ფორმაც ვერ გადახტება რიგში.
 */

async function guard(orderId: string, step: Step) {
  const session = await getSession();
  if (!session) throw new Error("არაავტორიზებული");
  if (!canDo(session.role, step)) throw new Error(`ამ ნაბიჯს ასრულებს: ${stepDef(step).role}`);

  const done = new Set(
    (await db.orderStep.findMany({ where: { orderId }, select: { step: true } })).map((s) => s.step)
  );
  if (!isOpen(step, done)) throw new Error("ნაბიჯი ჯერ არ არის ხელმისაწვდომი ან უკვე შესრულებულია");
  return session;
}

async function complete(orderId: string, step: Step, note: string | null, by: { id: string; name: string }) {
  await db.orderStep.create({
    data: { orderId, step, note: note?.trim() || null, adminId: by.id, byName: by.name },
  });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/workflow");
  revalidatePath("/admin/orders");
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** მარტივი დადასტურება — გადახდა, აღების ადგილზე მისვლა, ჩაბარება */
export async function confirmStep(formData: FormData) {
  const orderId = str(formData, "orderId");
  const step = str(formData, "step") as Step;
  const session = await guard(orderId, step);

  if (step === "PAYMENT_CONFIRMED") {
    // ნაშთის ჩამოწერა და შეტყობინება იმავე გზით, რაც ბანკის callback-ს აქვს
    await markOrderPaid(orderId, undefined, { notify: false });
    await db.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID", status: "PROCESSING" } });
  }
  if (step === "DELIVERED") {
    await db.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } });
  }
  if (step === "PICKUP_CONFIRMED") {
    await db.order.update({ where: { id: orderId }, data: { status: "SHIPPED" } });
  }

  await complete(orderId, step, str(formData, "note") || null, session);
}

/** 4 — შესყიდვები: ინვოისი და აღების მისამართი */
export async function saveSupplierInvoice(formData: FormData) {
  const orderId = str(formData, "orderId");
  const session = await guard(orderId, "SUPPLIER_INVOICE");

  const pickupAt = str(formData, "pickupAt");
  await db.orderFulfillment.upsert({
    where: { orderId },
    create: {
      orderId,
      supplierName: str(formData, "supplierName") || null,
      supplierInvoice: str(formData, "supplierInvoice") || null,
      pickupAddress: str(formData, "pickupAddress") || null,
      pickupAt: pickupAt ? new Date(pickupAt) : null,
    },
    update: {
      supplierName: str(formData, "supplierName") || null,
      supplierInvoice: str(formData, "supplierInvoice") || null,
      pickupAddress: str(formData, "pickupAddress") || null,
      pickupAt: pickupAt ? new Date(pickupAt) : null,
    },
  });

  await complete(orderId, "SUPPLIER_INVOICE", str(formData, "note") || null, session);
}

/** 7 — გაყიდვები: მიწოდების განაცხადი */
export async function saveDeliveryRequest(formData: FormData) {
  const orderId = str(formData, "orderId");
  const session = await guard(orderId, "DELIVERY_REQUEST");

  const weight = Number(str(formData, "weightKg").replace(",", "."));
  await db.orderFulfillment.upsert({
    where: { orderId },
    create: {
      orderId,
      weightKg: Number.isFinite(weight) && weight > 0 ? weight : null,
      dimensions: str(formData, "dimensions") || null,
      deliveryNote: str(formData, "deliveryNote") || null,
    },
    update: {
      weightKg: Number.isFinite(weight) && weight > 0 ? weight : null,
      dimensions: str(formData, "dimensions") || null,
      deliveryNote: str(formData, "deliveryNote") || null,
    },
  });

  await complete(orderId, "DELIVERY_REQUEST", str(formData, "note") || null, session);
}

/** 9 — ბუღალტერია: ზედნადები */
export async function saveWaybill(formData: FormData) {
  const orderId = str(formData, "orderId");
  const session = await guard(orderId, "WAYBILL");

  await db.orderFulfillment.upsert({
    where: { orderId },
    create: {
      orderId,
      waybillNumber: str(formData, "waybillNumber") || null,
      waybillUrl: str(formData, "waybillUrl") || null,
    },
    update: {
      waybillNumber: str(formData, "waybillNumber") || null,
      waybillUrl: str(formData, "waybillUrl") || null,
    },
  });

  await complete(orderId, "WAYBILL", str(formData, "note") || null, session);
}
