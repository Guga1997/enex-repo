/**
 * ხელით შეყვანილი პროდუქტი, რომელიც API-ს მიმწოდებელსაც აქვს — იშლება, რჩება API-ს.
 *
 *   npx tsx scripts/drop-manual-duplicates.ts          — ნახვა
 *   npx tsx scripts/drop-manual-duplicates.ts --write  — წაშლა
 *
 * „ხელით შეყვანილი“ — მიმწოდებლის გარეშე პროდუქტი (ადმინიდან ან ერთჯერადი
 * იმპორტით). დამთხვევა მხოლოდ კოდით/მოდელით, ≥ 6 სიმბოლო, ბრენდი არ ეწინააღმდეგება
 * და API-ს მხრიდან ზუსტად ერთი პროდუქტი — „B500“ (Bluetti) სამაგრსაც ემთხვეოდა.
 *
 * წაშლამდე: ფოტო/მახასიათებლები/ფაილები API-ს პროდუქტზე გადადის, თუ მას არ აქვს;
 * შეკვეთის სტრიქონები და რჩეულები API-ს პროდუქტზე გადაება.
 */
import { db } from "../src/lib/db";

const WRITE = process.argv.includes("--write");
const API_ADAPTERS = ["INTELLCOM", "MUK", "INTELECTRO", "GENERIC_REST"];

const norm = (s: string | null | undefined) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
/** „/GE“ — ჩვენი ძველი სუფიქსი ქართული ვერსიისთვის, კოდის ნაწილი არ არის */
const keysOf = (...vals: (string | null | undefined)[]) =>
  [...new Set(vals.flatMap((v) => [norm(v), norm(String(v ?? "").replace(/\/GE$/i, ""))]))].filter(
    (k) => k.length >= 6 && /\d/.test(k) && /[A-Z]/.test(k)
  );

(async () => {
  const select = {
    id: true, sku: true, model: true, nameKa: true, price: true,
    brand: { select: { name: true } },
    supplies: { select: { supplierSku: true, supplier: { select: { slug: true, adapter: true } } } },
    _count: { select: { images: true, attributes: true, documents: true, orderItems: true, favorites: true } },
  } as const;
  const all = await db.product.findMany({ select });
  const manual = all.filter((p) => p.supplies.length === 0);
  const api = all.filter((p) => p.supplies.some((s) => API_ADAPTERS.includes(s.supplier.adapter)));

  const index = new Map<string, typeof api>();
  for (const p of api) {
    for (const k of keysOf(p.sku, p.model, ...p.supplies.map((s) => s.supplierSku))) {
      const list = index.get(k) ?? [];
      if (!list.includes(p)) index.set(k, [...list, p]);
    }
  }
  const brandOk = (a?: string | null, b?: string | null) => !a || !b || a.toLowerCase() === b.toLowerCase();

  const pairs: { m: (typeof manual)[number]; p: (typeof api)[number]; key: string }[] = [];
  const unsure: string[] = [];
  for (const m of manual) {
    const hits = new Map<string, { p: (typeof api)[number]; key: string }>();
    for (const k of keysOf(m.sku, m.model)) {
      for (const p of index.get(k) ?? []) if (brandOk(m.brand?.name, p.brand?.name)) hits.set(p.id, { p, key: k });
    }
    if (hits.size === 1) pairs.push({ m, ...[...hits.values()][0] });
    else if (hits.size > 1) unsure.push(`${m.sku} ${m.nameKa.slice(0, 50)} — ${hits.size} შესაძლო დამთხვევა, არ ვშლი`);
  }

  for (const { m, p, key } of pairs) {
    console.log(`✕ ${m.sku.padEnd(22)} ${m.nameKa.slice(0, 48).padEnd(49)} ${String(m.price).padStart(8)}₾`);
    console.log(`  ✓ ${p.supplies.map((s) => s.supplier.slug).join(",").padEnd(20)} ${p.sku} ${p.nameKa.slice(0, 40)} ${p.price}₾  (${key})`);
  }
  for (const u of unsure) console.log(`? ${u}`);
  console.log(`\nწასაშლელი: ${pairs.length} (ხელით შეყვანილი სულ ${manual.length})`);

  if (!WRITE) {
    console.log("ცვლილება არ შესულა. გასაშვებად: --write");
    await db.$disconnect();
    return;
  }

  for (const { m, p } of pairs) {
    await db.$transaction(async (tx) => {
      if (m._count.images && !p._count.images) await tx.productImage.updateMany({ where: { productId: m.id }, data: { productId: p.id } });
      if (m._count.attributes && !p._count.attributes) await tx.productAttribute.updateMany({ where: { productId: m.id }, data: { productId: p.id } });
      if (m._count.documents && !p._count.documents) await tx.productDocument.updateMany({ where: { productId: m.id }, data: { productId: p.id } });
      await tx.orderItem.updateMany({ where: { productId: m.id }, data: { productId: p.id } });
      // რჩეული: ვისაც API-ს პროდუქტი უკვე აქვს რჩეულში, მისი ჩანაწერი წაშლასთან ერთად ქრება
      const favs = await tx.favorite.findMany({ where: { productId: m.id }, select: { id: true, userId: true } });
      for (const f of favs) {
        const has = await tx.favorite.findFirst({ where: { userId: f.userId, productId: p.id }, select: { id: true } });
        if (!has) await tx.favorite.update({ where: { id: f.id }, data: { productId: p.id } });
      }
      await tx.product.delete({ where: { id: m.id } });
    });
  }
  console.log(`✓ წაიშალა ${pairs.length}`);
  await db.$disconnect();
})();
