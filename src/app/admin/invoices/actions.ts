"use server";

import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { productFilter } from "@/lib/admin-filters";
import { availableQty, isPurchasable } from "@/lib/stock";
import { STOCK_LABELS } from "@/lib/constants";
import { effectivePrice } from "@/lib/pricing";
import { createStaffInvoice, type StaffInvoiceResult } from "@/lib/staff-order";

export type InvoiceProduct = {
  id: string; sku: string; name: string; model: string | null; image: string | null;
  price: number; available: number; inStock: boolean; stockLabel: string;
  minQty: number; qtyStep: number; unit: string | null;
  /** რატომ ვერ ჩაჯდება ინვოისში (ფასი არ აწერია / მარაგში არ არის) */
  blocked: string | null;
};

/** პროდუქტის ძებნა ინვოისისთვის — მხოლოდ საიტზე ხილული; თვითღირებულება არ ბრუნდება */
export async function searchForInvoice(q: string): Promise<InvoiceProduct[]> {
  await requireStaff("/admin/invoices");
  const query = q.trim().slice(0, 100);
  if (query.length < 2) return [];
  const rows = await db.product.findMany({
    where: productFilter({ q: query, status: "active" }),
    orderBy: [{ stockQty: "desc" }, { nameKa: "asc" }],
    take: 20,
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } },
  });
  return rows.map((p) => ({
    id: p.id, sku: p.sku, name: p.nameKa, model: p.model, image: p.images[0]?.url ?? null,
    price: effectivePrice(p, null).value,
    available: availableQty(p),
    inStock: p.stockStatus === "IN_STOCK",
    stockLabel: STOCK_LABELS[p.stockStatus] ?? p.stockStatus,
    minQty: p.minQty, qtyStep: p.qtyStep, unit: p.unit,
    blocked: !(p.price > 0) ? "ფასი არ აწერია" : !isPurchasable(p) ? "მარაგში არ არის" : null,
  }));
}

export async function createInvoice(payload: unknown): Promise<StaffInvoiceResult> {
  const session = await requireStaff("/admin/invoices");
  return createStaffInvoice(payload, { name: session.name });
}
