"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { repriceProduct, repriceSupplier } from "@/lib/suppliers/pricing";
import { saveTierShares } from "@/lib/pricing-settings";
import { MAX_PARTNER_SHARE } from "@/lib/pricing";

/**
 * „პროდუქციის ფასები“ — ფასების ერთადერთი მართვის ადგილი.
 * მიმწოდებლის წესი, პარტნიორების საფეხურები და ცალკეული პროდუქტის ფასი
 * მხოლოდ აქედან იცვლება.
 */

async function requireAdmin() {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  if (s.role !== "ADMIN") redirect("/admin/workflow");
}

const num = (fd: FormData, k: string): number | null => {
  const v = String(fd.get(k) ?? "").trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function refresh() {
  revalidatePath("/admin/prices");
  revalidatePath("/admin/prices/products");
  revalidatePath("/admin/products");
  revalidatePath("/catalog");
  revalidatePath("/");
}

const back = (path: string, msg: { ok?: string; error?: string }) => {
  const q = new URLSearchParams();
  if (msg.ok) q.set("ok", msg.ok);
  if (msg.error) q.set("error", msg.error);
  redirect(`${path}?${q}`);
};

/* ──────────────────────────── მიმწოდებლის წესი ──────────────────────────── */

/** წესის შენახვა და მისი პროდუქტების გადათვლა — ერთი ღილაკი */
export async function saveSupplierPricing(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const base = String(formData.get("retailBase") ?? "");
  const pct = num(formData, "markupRetail");
  if (!id || !["MARGIN", "LIST", "COST"].includes(base) || pct === null) {
    return back("/admin/prices", { error: "ფორმულა და პროცენტი სავალდებულოა" });
  }

  const s = await db.supplier.update({
    where: { id },
    data: {
      retailBase: base,
      markupRetail: pct,
      supplierDiscount: Math.min(90, Math.max(0, num(formData, "supplierDiscount") ?? 0)),
      minMargin: Math.min(500, Math.max(0, num(formData, "minMargin") ?? 0)),
      // ველი მხოლოდ „მოგების წილით“ / „მის საცალოზე“ რეჟიმში იგზავნება
      ...(formData.has("noListMarkup") ? { noListMarkup: num(formData, "noListMarkup") } : {}),
    },
  });

  const r = await repriceSupplier(id);
  refresh();
  return back("/admin/prices", { ok: `${s.name}: განახლდა ${r.updated}, უცვლელი ${r.skipped}, ჩაკეტილი ${r.locked}` });
}

export async function repriceAllAction() {
  await requireAdmin();
  const suppliers = await db.supplier.findMany({ select: { id: true } });
  let updated = 0;
  for (const s of suppliers) updated += (await repriceSupplier(s.id)).updated;
  refresh();
  return back("/admin/prices", { ok: `ყველა მიმწოდებელი გადაითვალა — განახლდა ${updated} პროდუქტი` });
}

/* ────────────────────────────── საფეხურები ────────────────────────────── */

export async function saveTiersAction(formData: FormData) {
  await requireAdmin();
  const order = ["DEALER", "SILVER", "GOLD", "PLATINUM"] as const;
  const max = MAX_PARTNER_SHARE * 100;
  const pct: Record<string, number> = {};
  for (const code of order) {
    const v = num(formData, code);
    if (v === null || v < 0 || v > max) {
      return back("/admin/prices", { error: `საფეხურის პროცენტი 0-დან ${max}-მდე უნდა იყოს` });
    }
    pct[code] = v;
  }
  for (let i = 1; i < order.length; i++) {
    if (pct[order[i]] < pct[order[i - 1]]) {
      return back("/admin/prices", { error: "საფეხურები ზრდადობით უნდა იყოს: დილერი ≤ ვერცხლი ≤ ოქრო ≤ პლატინა" });
    }
  }
  await saveTierShares(Object.fromEntries(order.map((c) => [c, pct[c] / 100])));
  refresh();
  return back("/admin/prices", { ok: "საფეხურები შენახულია — ახალი პროცენტი მაშინვე მოქმედებს" });
}

/* ─────────────────────────── ცალკეული პროდუქტი ─────────────────────────── */

/**
 * „ხელით“ მონიშნულზე ჩაწერილი ფასი იკეტება და სინქი/გადათვლა მას აღარ ცვლის.
 * მოხსნისას ფასი ისევ ფორმულით ითვლება. მიმწოდებლის გარეშე პროდუქტს ფორმულა
 * არ აქვს — იქ ჩაწერილი ფასი და თვითღირებულება ყოველთვის მოქმედებს.
 */
export async function saveProductPriceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const ret = String(formData.get("return") ?? "/admin/prices/products");
  const back2 = (msg: { ok?: string; error?: string }) => {
    const [path, query = ""] = ret.split("?");
    const q = new URLSearchParams(query);
    q.delete("ok");
    q.delete("error");
    if (msg.ok) q.set("ok", msg.ok);
    if (msg.error) q.set("error", msg.error);
    redirect(`${path.startsWith("/admin/prices") ? path : "/admin/prices/products"}?${q}`);
  };

  const product = await db.product.findUnique({
    where: { id },
    select: { sku: true, _count: { select: { supplies: true } } },
  });
  if (!product) return back2({ error: "პროდუქტი ვერ მოიძებნა" });

  const price = num(formData, "price");
  const oldPrice = num(formData, "oldPrice");
  const manual = formData.get("manual") === "on";
  const supplied = product._count.supplies > 0;

  if ((manual || !supplied) && (price === null || price <= 0)) {
    return back2({ error: `${product.sku}: ფასი 0-ზე მეტი უნდა იყოს` });
  }

  if (supplied && !manual) {
    await db.product.update({ where: { id }, data: { priceLocked: false, oldPrice } });
    await repriceProduct(id);
  } else {
    const cost = supplied ? undefined : num(formData, "cost");
    await db.product.update({
      where: { id },
      data: { price: price!, oldPrice, priceLocked: supplied, ...(cost !== undefined ? { cost } : {}) },
    });
  }

  refresh();
  return back2({ ok: `${product.sku}: შენახულია` });
}
