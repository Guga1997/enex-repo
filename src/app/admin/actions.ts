"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { productFilter } from "@/lib/admin-filters";
import { cancelOrder, markOrderPaid } from "@/lib/orders";
import { getSession, destroySession } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { generateApiKey } from "@/lib/api-auth";
import { StockStatus } from "@/lib/constants";

/** ყველა action-ის წინაპირობა — middleware იცავს როუტს, ეს იცავს თვით ქმედებას */
async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const numOrNull = (fd: FormData, key: string) => {
  const v = str(fd, key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* ---------------------------------- პროდუქტი --------------------------------- */

export async function saveProduct(formData: FormData) {
  await requireAdmin();

  const id = str(formData, "id");
  const sku = str(formData, "sku");
  const nameKa = str(formData, "nameKa");
  const categoryId = str(formData, "categoryId");

  if (!sku || !nameKa || !categoryId) {
    throw new Error("კოდი, დასახელება და კატეგორია სავალდებულოა");
  }

  // ბრენდი — თავისუფალი ტექსტი, ავტომატურად იქმნება
  const brandName = str(formData, "brandName");
  let brandId: string | null = null;
  if (brandName) {
    const brand = await db.brand.upsert({
      where: { slug: slugify(brandName) },
      create: { slug: slugify(brandName), name: brandName },
      update: { name: brandName },
    });
    brandId = brand.id;
  }

  const stockQty = Number(str(formData, "stockQty") || 0);
  const incoming = str(formData, "incomingDate");

  const data = {
    nameKa,
    nameEn: str(formData, "nameEn") || null,
    model: str(formData, "model") || null,
    descriptionKa: str(formData, "descriptionKa") || null,
    price: Number(str(formData, "price") || 0),
    oldPrice: numOrNull(formData, "oldPrice"),
    cost: numOrNull(formData, "cost"),
    stockQty,
    stockStatus: str(formData, "stockStatus") || StockStatus.IN_STOCK,
    incomingDate: incoming ? new Date(incoming) : null,
    lowStockAt: Number(str(formData, "lowStockAt") || 5),
    categoryId,
    brandId,
    isActive: formData.get("isActive") === "on",
    isNew: formData.get("isNew") === "on",
    featured: formData.get("featured") === "on",
    sortOrder: Number(str(formData, "sortOrder") || 0),
  };

  // ხელით შეცვლილი ფასი იკეტება — სინქმა და გადათვლამ აღარ გადააწეროს
  const before = id ? await db.product.findUnique({ where: { id }, select: { price: true, dealerPrice: true } }) : null;
  const dealerPrice = numOrNull(formData, "dealerPrice");
  const priceLocked = formData.get("priceLocked") === "on" ||
    (before ? before.price !== data.price || before.dealerPrice !== dealerPrice : false);

  const product = id
    ? await db.product.update({ where: { id }, data: { ...data, dealerPrice, priceLocked } })
    : await db.product.create({ data: { ...data, dealerPrice, priceLocked, sku, slug: `${slugify(nameKa)}-${sku}` } });

  // სურათები — მძიმით/ახალი ხაზით გამოყოფილი URL-ების სია
  const imageList = str(formData, "images")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  await db.productImage.deleteMany({ where: { productId: product.id } });
  if (imageList.length) {
    await db.productImage.createMany({
      data: imageList.map((url, i) => ({ productId: product.id, url, sortOrder: i })),
    });
  }

  // მახასიათებლები — "სახელი: მნიშვნელობა" თითო ხაზზე
  const attrLines = str(formData, "attributes")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  await db.productAttribute.deleteMany({ where: { productId: product.id } });
  if (attrLines.length) {
    const rows = attrLines
      .map((line, i) => {
        const idx = line.indexOf(":");
        if (idx < 1) return null;
        return {
          productId: product.id,
          name: line.slice(0, idx).trim(),
          value: line.slice(idx + 1).trim(),
          sortOrder: i,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && r.value.length > 0);
    if (rows.length) await db.productAttribute.createMany({ data: rows });
  }

  revalidatePath("/admin/products");
  revalidatePath("/catalog");
  redirect("/admin/products?saved=1");
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.product.delete({ where: { id } });
  revalidatePath("/admin/products");
  revalidatePath("/catalog");
}

export async function toggleProductActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const product = await db.product.findUnique({ where: { id } });
  if (!product) return;
  await db.product.update({ where: { id }, data: { isActive: !product.isActive } });
  revalidatePath("/admin/products");
}

/* --------------------------------- კატეგორია -------------------------------- */

export async function saveCategory(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const nameKa = str(formData, "nameKa");
  if (!nameKa) throw new Error("დასახელება სავალდებულოა");

  const parentId = str(formData, "parentId") || null;
  const data = {
    nameKa,
    nameEn: str(formData, "nameEn") || null,
    parentId,
    sortOrder: Number(str(formData, "sortOrder") || 0),
    isActive: formData.get("isActive") === "on",
  };

  if (id) await db.category.update({ where: { id }, data });
  else await db.category.create({ data: { ...data, slug: slugify(nameKa) } });

  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
}

export async function toggleCategoryActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const category = await db.category.findUnique({ where: { id } });
  if (!category) return;
  await db.category.update({ where: { id }, data: { isActive: !category.isActive } });
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const count = await db.product.count({ where: { categoryId: id } });
  if (count > 0) throw new Error(`კატეგორიაში ${count} პროდუქტია — ჯერ გადაიტანე ან წაშალე`);
  await db.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
}

/* --------------------------------- შეკვეთა ---------------------------------- */

export async function updateOrderStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const paymentStatus = String(formData.get("paymentStatus") ?? "");

  // გაუქმება რეზერვაციასაც ხსნის; გადახდილად მონიშვნა ნაშთს ჩამოწერს — ორივე ერთი გზით
  if (status === "CANCELLED") {
    await cancelOrder(id, "CANCELLED");
  } else if (paymentStatus === "PAID") {
    await markOrderPaid(id, undefined, { notify: false });
  }

  await db.order.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
    },
  });
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
}

/* -------------------------------- API გასაღები ------------------------------- */

export async function createApiKey(formData: FormData) {
  await requireAdmin();
  const name = str(formData, "name") || "უსახელო";
  const scopes = str(formData, "scopes") || "stock:read,stock:write";

  const { raw, hash, prefix } = generateApiKey();
  await db.apiKey.create({ data: { name, keyHash: hash, prefix, scopes } });

  // ღია გასაღები ერთხელ ჩანს — URL-ში გადავცემთ ჩვენებისთვის
  revalidatePath("/admin/api-keys");
  redirect(`/admin/api-keys?created=${encodeURIComponent(raw)}`);
}

export async function revokeApiKey(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await db.apiKey.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/admin/api-keys");
}

export async function deleteApiKey(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await db.apiKey.delete({ where: { id } });
  revalidatePath("/admin/api-keys");
}

/* ------------------------------- მიმწოდებლები ------------------------------- */

export async function saveSupplier(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const secret = String(formData.get("secret") ?? "");
  const data = {
    name,
    adapter: String(formData.get("adapter") ?? "GENERIC_REST"),
    baseUrl: String(formData.get("baseUrl") ?? "").trim() || null,
    authType: String(formData.get("authType") ?? "BEARER"),
    authHeader: String(formData.get("authHeader") ?? "").trim() || null,
    fieldMap: String(formData.get("fieldMap") ?? "").trim() || null,
    retailBase: formData.get("retailBase") === "LIST" ? "LIST" : "COST",
    markupRetail: Number(formData.get("markupRetail") ?? 30),
    markupDealer: Number(formData.get("markupDealer") ?? 15),
    // 0 = მხოლოდ ხელით; უარყოფითი და არარიცხვი ნულად
    syncEveryMin: Math.max(0, Math.floor(Number(formData.get("syncEveryMin")) || 0)),
    isActive: formData.get("isActive") === "on",
    // ცარიელი ველი არსებულ გასაღებს არ შლის
    ...(secret ? { secret } : {}),
  };

  if (id) {
    await db.supplier.update({ where: { id }, data });
  } else {
    let slug = slugify(name) || "supplier";
    if (await db.supplier.findUnique({ where: { slug } })) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
    await db.supplier.create({ data: { ...data, slug } });
  }
  revalidatePath("/admin/suppliers");
}

/** ფასების გადათვლა მიმწოდებლის მიმდინარე წესით — ჩაკეტილი ფასები რჩება */
export async function repriceSupplierAction(formData: FormData) {
  await requireAdmin();
  const { repriceSupplier } = await import("@/lib/suppliers/pricing");
  await repriceSupplier(String(formData.get("id") ?? ""));
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/products");
}

/* ---------------------------------- ბანერები --------------------------------- */

export async function saveBanner(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const image = str(formData, "image").split(/\r?\n/)[0]?.trim();
  const title = str(formData, "title");
  let href = str(formData, "href");
  if (!image || !title || !href) throw new Error("სურათი, სათაური და ბმული სავალდებულოა");
  // მხოლოდ საიტის შიდა ბმული — სლაიდერი გარეთ არ უნდა გაჰყავდეს
  if (!href.startsWith("/")) href = "/" + href;
  const data = {
    title,
    subtitle: str(formData, "subtitle") || null,
    image,
    href,
    sortOrder: Number(str(formData, "sortOrder") || 0),
    isActive: formData.get("isActive") === "on",
  };
  if (id) await db.banner.update({ where: { id }, data });
  else await db.banner.create({ data });
  revalidatePath("/");
  revalidatePath("/admin/banners");
  redirect("/admin/banners");
}

export async function deleteBanner(formData: FormData) {
  await requireAdmin();
  await db.banner.delete({ where: { id: str(formData, "id") } });
  revalidatePath("/");
  revalidatePath("/admin/banners");
}

/** სეგმენტური წესი — მიმწოდებელი × კატეგორია; შენახვისთანავე ფასები გადაითვლება */
export async function savePricingRule(formData: FormData) {
  await requireAdmin();
  const supplierId = String(formData.get("supplierId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!supplierId || !categoryId) return;
  const data = {
    retailBase: formData.get("retailBase") === "LIST" ? "LIST" : "COST",
    markupRetail: Number(formData.get("markupRetail")) || 0,
    markupDealer: Number(formData.get("markupDealer")) || 0,
  };
  await db.supplierPricingRule.upsert({
    where: { supplierId_categoryId: { supplierId, categoryId } },
    create: { supplierId, categoryId, ...data },
    update: data,
  });
  const { repriceSupplier } = await import("@/lib/suppliers/pricing");
  await repriceSupplier(supplierId);
  revalidatePath(`/admin/suppliers/${supplierId}/pricing`);
  revalidatePath("/admin/products");
}

export async function deletePricingRule(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const rule = await db.supplierPricingRule.findUnique({ where: { id } });
  if (!rule) return;
  await db.supplierPricingRule.delete({ where: { id } });
  const { repriceSupplier } = await import("@/lib/suppliers/pricing");
  await repriceSupplier(rule.supplierId);
  revalidatePath(`/admin/suppliers/${rule.supplierId}/pricing`);
  revalidatePath("/admin/products");
}

export async function deleteSupplier(formData: FormData) {
  await requireAdmin();
  await db.supplier.delete({ where: { id: String(formData.get("id") ?? "") } });
  revalidatePath("/admin/suppliers");
}

/** სინქი ხელით — გრაფიკით გაშვება cron-ის საქმეა */
export async function runSupplierSync(formData: FormData) {
  await requireAdmin();
  const { syncSupplier } = await import("@/lib/suppliers");
  await syncSupplier(String(formData.get("id") ?? ""));
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/products");
  revalidatePath("/catalog");
}

/** კავშირის შემოწმება — ბაზაში არაფერს წერს, მხოლოდ ითვლის რამდენი პოზიცია მოვიდა */
export async function testSupplier(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const supplier = await db.supplier.findUnique({ where: { id } });
  if (!supplier) redirect("/admin/suppliers?test=ვერ%20მოიძებნა");

  const { resolveAdapter } = await import("@/lib/suppliers");
  try {
    const items = await resolveAdapter(supplier.adapter).fetchItems({
      slug: supplier.slug,
      name: supplier.name,
      baseUrl: supplier.baseUrl,
      authType: supplier.authType,
      secret: supplier.secret,
      authHeader: supplier.authHeader,
      fieldMap: supplier.fieldMap,
    });
    const sample = items[0];
    redirect(
      `/admin/suppliers?test=${encodeURIComponent(
        `${supplier.name}: მოვიდა ${items.length} პოზიცია` +
          (sample ? ` · მაგალითი: ${sample.supplierSku} — ${sample.name}` : "")
      )}`
    );
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    redirect(
      `/admin/suppliers?error=${encodeURIComponent(
        `${supplier.name}: ${e instanceof Error ? e.message : String(e)}`
      )}`
    );
  }
}

/* ---------------------------- პროდუქტის დოკუმენტი ---------------------------- */

export async function addProductDocument(formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!productId || !url || !title) return;

  await db.productDocument.create({
    data: {
      productId,
      url,
      title,
      kind: String(formData.get("kind") ?? "DATASHEET"),
      sizeBytes: Number(formData.get("sizeBytes")) || null,
    },
  });
  revalidatePath(`/admin/products/${productId}`);
}

export async function deleteProductDocument(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const doc = await db.productDocument.delete({ where: { id } });
  revalidatePath(`/admin/products/${doc.productId}`);
}

/* ------------------------------ მომხმარებლები ------------------------------ */

export async function setUserTier(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await db.user.update({
    where: { id },
    data: {
      priceTier: String(formData.get("priceTier") ?? "RETAIL"),
      discountPercent: Number(formData.get("discountPercent") ?? 0),
      isActive: formData.get("isActive") === "on",
    },
  });
  revalidatePath("/admin/users");
}

/* --------------------- სერიული ნომრები და გარანტია --------------------- */

/** მიწოდებისას ივსება; გარანტიის ვადა თარიღიდან ითვლება */
export async function setItemSerials(formData: FormData) {
  await requireAdmin();
  const itemId = String(formData.get("itemId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const serials = String(formData.get("serialNumbers") ?? "").trim();
  const months = Number(formData.get("warrantyMonths")) || null;

  const until = months ? new Date() : null;
  if (until && months) until.setMonth(until.getMonth() + months);

  await db.orderItem.update({
    where: { id: itemId },
    data: {
      serialNumbers: serials || null,
      warrantyMonths: months,
      warrantyUntil: until,
    },
  });
  revalidatePath(`/admin/orders/${orderId}`);
}

/* ------------------------ პროდუქტების მასობრივი მართვა ------------------------ */

/** მონიშნული პროდუქტების გამოქვეყნება ან დამალვა */
export async function bulkSetActive(formData: FormData) {
  await requireAdmin();
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const active = formData.get("active") === "1";
  if (ids.length === 0) return;
  await db.product.updateMany({ where: { id: { in: ids } }, data: { isActive: active } });
  revalidatePath("/admin/products");
  revalidatePath("/catalog");
  revalidatePath("/", "layout");
}

/**
 * მთელი გაფილტრული სიის გამოქვეყნება/დამალვა — არა მხოლოდ ერთი გვერდის.
 * ფილტრი იმავე პარამეტრებით მოდის, რითაც სია ჩანს, რომ „რასაც ხედავ, იმას ცვლი“.
 */
export async function bulkSetActiveByFilter(formData: FormData) {
  await requireAdmin();
  const active = formData.get("active") === "1";
  const where = productFilter({
    q: String(formData.get("q") ?? ""),
    category: String(formData.get("category") ?? ""),
    supplier: String(formData.get("supplier") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  await db.product.updateMany({ where, data: { isActive: active } });
  revalidatePath("/admin/products");
  revalidatePath("/catalog");
  revalidatePath("/", "layout");
}

/* ------------------------------ ადმინის ანგარიში ------------------------------ */

export async function changeAdminPassword(formData: FormData) {
  const session = await requireAdmin();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const next2 = String(formData.get("next2") ?? "");

  if (next.length < 10) redirect("/admin/account?error=short");
  if (next !== next2) redirect("/admin/account?error=mismatch");

  const admin = await db.admin.findUnique({ where: { id: session.id } });
  if (!admin || !(await bcrypt.compare(current, admin.passwordHash))) {
    redirect("/admin/account?error=current");
  }

  await db.admin.update({
    where: { id: admin.id },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });
  redirect("/admin/account?ok=1");
}

export async function changeAdminEmail(formData: FormData) {
  const session = await requireAdmin();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/admin/account?error=email");

  const admin = await db.admin.findUnique({ where: { id: session.id } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    redirect("/admin/account?error=current");
  }
  if (await db.admin.findFirst({ where: { email, id: { not: admin.id } } })) {
    redirect("/admin/account?error=taken");
  }

  await db.admin.update({ where: { id: admin.id }, data: { email } });
  // სესიაში ძველი ელფოსტა წერია — ხელახლა შესვლა სუფთა გზაა
  await destroySession();
  redirect("/admin/login?changed=1");
}
