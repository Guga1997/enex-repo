import { db } from "../db";
import { slugify } from "../format";
import { localizeMedia } from "../media";
import { genericRest } from "./generic-rest";
import { intellcom } from "./intellcom";
import { spreadsheet } from "./spreadsheet";
import { computePrices, Pricer, repriceProduct } from "./pricing";
import type { SupplierAdapter, SupplierConfig, SupplierItem } from "./types";

export type { SupplierItem, SupplierConfig, SupplierAdapter } from "./types";

/** სპეციფიკური ადაპტერები აქ ირიცხება; დანარჩენს GENERIC_REST ემსახურება */
const ADAPTERS: Record<string, SupplierAdapter> = {
  GENERIC_REST: genericRest,
  INTELLCOM: intellcom,
  SPREADSHEET: spreadsheet,
};

export function resolveAdapter(name: string): SupplierAdapter {
  const adapter = ADAPTERS[name];
  if (!adapter) throw new Error(`ადაპტერი "${name}" არ არსებობს`);
  return adapter;
}

export const adapterNames = () => Object.keys(ADAPTERS);

export const FALLBACK = "დაუკატეგორიებელი (იმპორტი)";

/** „ხმამაღლამოლაპარაკე“ ≈ „ხმამაღლამოლაპარაკეები“ ≈ „ხმამაღლამოლაპარაკეები (AV)“ */
function normCat(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[\s\-–—_/,.]+/g, "")
    .replace(/(ები|ებზე|ის)$/u, "")
    .replace(/[აი]$/u, ""); // კამერა/კამერები → კამერ, დისკი/დისკები → დისკ
}

/**
 * მიმწოდებლების სახელები, რომლებიც ჩვენს ხეს არ ემთხვევა — ნორმალიზებული → ჩვენი კატეგორია.
 * ახალი მიმწოდებლის დამატებისას აქ ივსება; scripts/recategorize.ts აჩვენებს, რა დარჩა უცნობი.
 */
const CATEGORY_ALIASES: Record<string, string> = {
  // romsat
  "მისამართულისახანძროსისტემ": "მისამართიანი სახანძრო სიგნალიზაცია",
  "არამისამართულისახანძროსისტემ": "არამისამართიანი სახანძრო სიგნალიზაცია",
  "სიგნალიზაცი": "სახანძრო სიგნალიზაცია",
  "ქსელურიჩამწერ": "IP ვიდეო-ჩამწერები (NVR)",
  "ანალოგურიჩამწერ": "ანალოგური ვიდეო-ჩამწერები (DVR/XVR)",
  "აუდიოევაკუაციისსისტემ": "გახმოვანების სისტემები",
  "en54ხმამაღლამოლაპარაკე": "ხმამაღლამოლაპარაკეები",
  "en54გამაძლიერებელ": "ხმის გამაძლიერებლები",
  "გამაძლიერებლ": "ხმის გამაძლიერებლები",
  "en54როუტერ": "გახმოვანების აქსესუარები",
  "en54მიკროფონ": "გახმოვანების აქსესუარები",
  "ipაუდიო": "გახმოვანების სისტემები",
  "უკაბელოსისტემ": "გახმოვანების სისტემები",
  "ქსელისკაბელ": "LAN კაბელები",
  "უწყვეტიკვებისწყარო": "უწყვეტი კვების წყაროები UPS",
  "მონიტორისაქსესუარ": "მონიტორები",
  "ინტერაქტიულიდაფ": "ინტერაქტიული ეკრანები",
  // Delta / Bluetti ფასთა ნუსხა (Excel)
  "ups": "უწყვეტი კვების წყაროები UPS",
  "batterypack": "UPS აქსესუარები",
  "pdusnmp": "UPS აქსესუარები",
  "railkit": "UPS აქსესუარები",
  "portablepowerstation": "პორტატული ელსადგურები",
};

/** ფრჩხილებში კოდი — (NVR), (DVR/XVR), (UPS) — ორივე მხარეს ერთი და იგივე თუა, ესეც დამთხვევაა */
const parenCode = (s: string) => s.match(/\(([A-Za-z0-9/ ]{3,})\)/)?.[1].toUpperCase().trim() ?? null;

/**
 * კატეგორიის გზა სახელებით — ყველაზე კონკრეტულიდან ზოგადისკენ. თანმიმდევრობით:
 * ზუსტი დამთხვევა → ნორმალიზებული (მხოლობითი/მრავლობითი, ფრჩხილები) → ალიასი → ფრჩხილების კოდი.
 * ვერ ამოცნობილი ჯდება საიმპორტო კალათაში.
 */
export async function resolveCategoryId(path: string[] | undefined): Promise<string> {
  if (path?.length) {
    // SQLite-ს რეგისტრის უგულებელყოფა არ შეუძლია — შედარებას მეხსიერებაში ვაკეთებთ
    const all = await db.category.findMany({ select: { id: true, nameKa: true } });
    const byName = new Map(all.map((c) => [c.nameKa.trim().toLowerCase(), c.id]));
    const byNorm = new Map(all.map((c) => [normCat(c.nameKa), c.id]));
    const byCode = new Map<string, string>();
    for (const c of all) {
      const code = parenCode(c.nameKa);
      if (code && !byCode.has(code)) byCode.set(code, c.id);
    }
    for (const name of [...path].reverse()) {
      const norm = normCat(name);
      const alias = CATEGORY_ALIASES[norm];
      const code = parenCode(name);
      const hit =
        byName.get(name.trim().toLowerCase()) ??
        byNorm.get(norm) ??
        (alias ? byName.get(alias.toLowerCase()) : undefined) ??
        (code ? byCode.get(code) : undefined);
      if (hit) return hit;
    }
  }
  const existing = await db.category.findFirst({ where: { nameKa: FALLBACK } });
  if (existing) return existing.id;
  const created = await db.category.create({
    data: { slug: "importi-daukategoriebeli", nameKa: FALLBACK, isActive: false, sortOrder: 999 },
  });
  return created.id;
}

/**
 * არსებული პროდუქტი ფსკერზე ან ფესვშია? — მიმწოდებლის გზით უფრო კონკრეტულს ვეძებთ.
 * ადმინის ხელით არჩეულ ქვეკატეგორიას არ ვეხებით.
 */
async function recategorizeIfVague(productId: string, path: string[] | undefined) {
  if (!path?.length) return;
  const p = await db.product.findUnique({
    where: { id: productId },
    select: { categoryId: true, category: { select: { nameKa: true, parentId: true } } },
  });
  if (!p) return;
  const vague = p.category.nameKa === FALLBACK || p.category.parentId === null;
  if (!vague) return;
  const next = await resolveCategoryId(path);
  if (next === p.categoryId) return;
  const cat = await db.category.findUnique({ where: { id: next }, select: { nameKa: true, parentId: true } });
  if (!cat || cat.nameKa === FALLBACK || cat.parentId === null) return; // უკეთესი არ არის
  await db.product.update({ where: { id: productId }, data: { categoryId: next } });
}

async function resolveBrandId(name: string | null | undefined): Promise<string | null> {
  if (!name?.trim()) return null;
  const clean = name.trim();
  const found = await db.brand.findFirst({ where: { name: clean } });
  if (found) return found.id;
  let slug = slugify(clean) || "brand";
  if (await db.brand.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  return (await db.brand.create({ data: { name: clean, slug } })).id;
}

async function uniqueProductSlug(name: string, sku: string): Promise<string> {
  const base = slugify(name) || `p-${sku}`;
  if (!(await db.product.findUnique({ where: { slug: base } }))) return base;
  return `${base}-${slugify(sku) || Math.random().toString(36).slice(2, 7)}`;
}

/**
 * პროდუქტის მიბმა მიმწოდებლის პოზიციაზე — სამი მცდელობა, სანამ ახალს შევქმნით:
 * ამავე მიმწოდებლის ძველი ჩანაწერი → ჩვენი SKU → მოდელი+ბრენდი.
 */
async function matchProductId(supplierId: string, item: SupplierItem): Promise<string | null> {
  const supply = await db.productSupply.findUnique({
    where: { supplierId_supplierSku: { supplierId, supplierSku: item.supplierSku } },
    select: { productId: true },
  });
  if (supply) return supply.productId;

  const bySku = await db.product.findUnique({
    where: { sku: item.supplierSku },
    select: { id: true },
  });
  if (bySku) return bySku.id;

  if (item.model?.trim()) {
    const byModel = await db.product.findFirst({
      where: {
        model: item.model.trim(),
        ...(item.brand ? { brand: { name: item.brand.trim() } } : {}),
      },
      select: { id: true },
    });
    if (byModel) return byModel.id;
  }
  return null;
}

/** ნაშთი პროდუქტზე = მისი ყველა მიმწოდებლის ჯამი */
export async function rollupStock(productId: string) {
  const supplies = await db.productSupply.findMany({ where: { productId } });
  const qty = supplies.reduce((sum, s) => sum + s.qty, 0);

  const etas = supplies
    .filter((s) => s.incomingDate && s.qty <= 0)
    .map((s) => s.incomingDate!.getTime());

  /* ნაშთი ნულია, მაგრამ ეს ჯერ არ ნიშნავს „არ გვაქვს“:
     მიმწოდებელს შეიძლება გზაში ჰქონდეს ან წინასწარი შეკვეთით იღებდეს. */
  const status =
    qty > 0
      ? "IN_STOCK"
      : etas.length
        ? "IN_TRANSIT"
        : supplies.some((s) => s.status === "PREORDER")
          ? "PREORDER"
          : "OUT_OF_STOCK";

  await db.product.update({
    where: { id: productId },
    data: {
      stockQty: qty,
      stockStatus: status,
      incomingDate: etas.length ? new Date(Math.min(...etas)) : null,
    },
  });
}

export type SyncResult = {
  ok: boolean;
  created: number;
  updated: number;
  failed: number;
  message?: string;
};

/**
 * ერთი მიმწოდებლის სინქი.
 * ფასი ყოველ სინქზე თავიდან ითვლება — მიმწოდებელმა რომ გააძვიროს, ჩვენი პროცენტი
 * მას მიჰყვება. ხელით ჩაკეტილს (priceLocked) არ ეხება.
 * ახალი პროდუქტი მოდის გამორთული, რომ ადმინმა ჯერ დაათვალიეროს.
 */
export async function syncSupplier(supplierId: string): Promise<SyncResult> {
  const supplier = await db.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    return { ok: false, created: 0, updated: 0, failed: 0, message: "მიმწოდებელი ვერ მოიძებნა" };
  }

  const log = await db.supplierSyncLog.create({ data: { supplierId } });
  let created = 0;
  let updated = 0;
  let failed = 0;
  const touched = new Set<string>();
  const created_ids: string[] = [];

  try {
    const cfg: SupplierConfig = {
      slug: supplier.slug,
      name: supplier.name,
      baseUrl: supplier.baseUrl,
      authType: supplier.authType,
      secret: supplier.secret,
      authHeader: supplier.authHeader,
      fieldMap: supplier.fieldMap,
    };
    const items = await resolveAdapter(supplier.adapter).fetchItems(cfg);
    const pricer = await Pricer.load();

    for (const item of items) {
      try {
        let productId = await matchProductId(supplier.id, item);

        if (!productId) {
          const categoryId = await resolveCategoryId(item.categoryPath);
          const prices = computePrices(
            pricer.ruleFor(supplier.id, categoryId) ?? supplier,
            item.cost,
            item.listPrice
          );
          const product = await db.product.create({
            data: {
              sku: item.supplierSku,
              slug: await uniqueProductSlug(item.name, item.supplierSku),
              nameKa: item.name,
              model: item.model ?? null,
              descriptionKa: item.description ?? null,
              price: prices.price,
              dealerPrice: prices.dealerPrice,
              cost: item.cost ?? null,
              weightKg: item.weightKg ?? null,
              volumeM3: item.volumeM3 ?? null,
              warrantyMonths: item.warrantyMonths ?? null,
              categoryId,
              brandId: await resolveBrandId(item.brand),
              isActive: false,
            },
          });
          productId = product.id;
          created++;
          created_ids.push(product.id);

          if (item.images?.length) {
            await db.productImage.createMany({
              data: item.images.map((url, i) => ({ productId: product.id, url, sortOrder: i })),
            });
          }
          if (item.attributes?.length) {
            await db.productAttribute.createMany({
              data: item.attributes.map((a, i) => ({
                productId: product.id,
                name: a.name,
                value: a.value,
                sortOrder: i,
              })),
            });
          }
          if (item.documents?.length) {
            await db.productDocument.createMany({
              data: item.documents.map((d, i) => ({
                productId: product.id,
                title: d.title,
                url: d.url,
                sortOrder: i,
              })),
            });
          }
        } else {
          const pid: string = productId;
          await recategorizeIfVague(pid, item.categoryPath);
          // დოკუმენტები/მახასიათებლები, თუ პროდუქტს ჯერ არ აქვს — მიმწოდებელმა მოგვიანებით რომ დაამატოს
          if (item.documents?.length && !(await db.productDocument.count({ where: { productId: pid } }))) {
            await db.productDocument.createMany({
              data: item.documents.map((d, i) => ({ productId: pid, title: d.title, url: d.url, sortOrder: i })),
            });
          }
          if (item.attributes?.length && !(await db.productAttribute.count({ where: { productId: pid } }))) {
            await db.productAttribute.createMany({
              data: item.attributes.map((a, i) => ({ productId: pid, name: a.name, value: a.value, sortOrder: i })),
            });
          }
          await db.product.update({
            where: { id: productId },
            data: {
              cost: item.cost ?? undefined,
              weightKg: item.weightKg ?? undefined,
              volumeM3: item.volumeM3 ?? undefined,
              warrantyMonths: item.warrantyMonths ?? undefined,
            },
          });
          updated++;
        }

        const supplyData = {
          productId,
          cost: item.cost ?? null,
          listPrice: item.listPrice ?? null,
          qty: item.qty,
          status: item.status ?? (item.qty > 0 ? "IN_STOCK" : "OUT_OF_STOCK"),
          incomingDate: item.incomingDate ?? null,
          leadTimeDays: item.leadTimeDays ?? null,
        };

        await db.productSupply.upsert({
          where: {
            supplierId_supplierSku: {
              supplierId: supplier.id,
              supplierSku: item.supplierSku,
            },
          },
          create: { supplierId: supplier.id, supplierSku: item.supplierSku, ...supplyData },
          update: supplyData,
        });

        touched.add(productId);
      } catch {
        failed++;
      }
    }

    for (const id of touched) {
      await rollupStock(id);
      await repriceProduct(id, pricer);
    }

    // ახალი პროდუქტების სურათები და დოკუმენტები მაშინვე ჩვენს დისკზე —
    // მიმწოდებელი hotlink-ს არ უშვებს. ჩავარდნა სინქს არ აჩერებს.
    if (created_ids.length) {
      try {
        await localizeMedia({ productIds: created_ids });
      } catch (e) {
        console.error("მედიის ჩამოტვირთვა ჩავარდა", e);
      }
    }

    await db.$transaction([
      db.supplierSyncLog.update({
        where: { id: log.id },
        data: { finishedAt: new Date(), ok: true, created, updated, failed },
      }),
      db.supplier.update({
        where: { id: supplier.id },
        data: { lastSyncAt: new Date(), lastSyncStatus: "OK" },
      }),
    ]);

    return { ok: true, created, updated, failed };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.$transaction([
      db.supplierSyncLog.update({
        where: { id: log.id },
        data: { finishedAt: new Date(), ok: false, created, updated, failed, message },
      }),
      db.supplier.update({
        where: { id: supplier.id },
        data: { lastSyncAt: new Date(), lastSyncStatus: "ERROR" },
      }),
    ]);
    return { ok: false, created, updated, failed, message };
  }
}
