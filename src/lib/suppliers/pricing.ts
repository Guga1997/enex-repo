import { db } from "../db";

/**
 * ფასწარმოქმნა მიმწოდებლის მონაცემებიდან.
 *
 *   სადილერო = თვითღირებულება × (1 + markupDealer%)         — ყოველთვის მასზე მაღლა
 *   საცალო   = ბაზა × (1 + markupRetail%), სადაც ბაზა:
 *              COST — თვითღირებულება (ჩვეულებრივი ფასდადება, +30)
 *              LIST — მიმწოდებლის საცალო ფასი (მასზე დაბლა — უარყოფითი %, −5)
 *
 * წესი სამ დონეზეა: მიმწოდებელი × კონკრეტული სეგმენტი → მშობელი სეგმენტი → მიმწოდებლის
 * ნაგულისხმევი. პროცენტი მიმწოდებლის ფასს მიჰყვება — ყოველი სინქი თავიდან ითვლის,
 * ხელით ჩაკეტილი (priceLocked) ფასის გარდა.
 */

export type PricingRule = { retailBase: string; markupRetail: number; markupDealer: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computePrices(
  rule: PricingRule,
  cost: number | null | undefined,
  listPrice: number | null | undefined
): { price: number; dealerPrice: number | null } {
  const c = cost && cost > 0 ? cost : null;
  const base = rule.retailBase === "LIST" && listPrice && listPrice > 0 ? listPrice : c;
  const dealerPrice = c ? round2(c * (1 + rule.markupDealer / 100)) : null;
  let price = base ? round2(base * (1 + rule.markupRetail / 100)) : 0;
  // საცალო სადილეროზე დაბლა არასდროს — LIST-ბაზაზე მიმწოდებელმა საცალო რომ არ მოგვცეს,
  // −5% თვითღირებულებას დაედებოდა და წაგებაზე გავყიდდით
  if (dealerPrice !== null && price < dealerPrice) price = dealerPrice;
  return { price, dealerPrice };
}

/**
 * წესების ერთჯერადი ჩატვირთვა — ათას პროდუქტზე ათასჯერ კატეგორიების ხეს არ ვკითხულობთ.
 * ერთი სინქის ან ერთი გადათვლის სიცოცხლისთვისაა.
 */
export class Pricer {
  private constructor(
    private parents: Map<string, string | null>,
    private rules: Map<string, PricingRule>, // `${supplierId}:${categoryId}`
    private defaults: Map<string, PricingRule> // supplierId
  ) {}

  static async load(): Promise<Pricer> {
    const [cats, rules, suppliers] = await Promise.all([
      db.category.findMany({ select: { id: true, parentId: true } }),
      db.supplierPricingRule.findMany(),
      db.supplier.findMany({ select: { id: true, retailBase: true, markupRetail: true, markupDealer: true } }),
    ]);
    return new Pricer(
      new Map(cats.map((c) => [c.id, c.parentId])),
      new Map(rules.map((r) => [`${r.supplierId}:${r.categoryId}`, r])),
      new Map(suppliers.map((s) => [s.id, s]))
    );
  }

  /** კონკრეტული სეგმენტიდან ზემოთ — პირველი ნაპოვნი წესი მოქმედებს */
  ruleFor(supplierId: string, categoryId: string | null): PricingRule | null {
    let cat = categoryId;
    for (let depth = 0; cat && depth < 10; depth++) {
      const r = this.rules.get(`${supplierId}:${cat}`);
      if (r) return r;
      cat = this.parents.get(cat) ?? null;
    }
    return this.defaults.get(supplierId) ?? null;
  }

  /** რომელი დონის წესია — ადმინში საჩვენებლად */
  ruleSource(supplierId: string, categoryId: string | null): "category" | "parent" | "supplier" {
    let cat = categoryId;
    for (let depth = 0; cat && depth < 10; depth++) {
      if (this.rules.has(`${supplierId}:${cat}`)) return depth === 0 ? "category" : "parent";
      cat = this.parents.get(cat) ?? null;
    }
    return "supplier";
  }
}

export type RepriceOutcome = "updated" | "locked" | "skipped";

/**
 * პროდუქტის ფასი ყველა მიმწოდებლიდან — ყველაზე იაფი წყაროს წესით.
 * ჩაკეტილს არ ეხება. ერთსა და იმავე ფასზე ბაზას არ წერს.
 */
export async function repriceProduct(productId: string, pricer?: Pricer): Promise<RepriceOutcome> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      price: true,
      dealerPrice: true,
      priceLocked: true,
      categoryId: true,
      supplies: { select: { supplierId: true, cost: true, listPrice: true } },
    },
  });
  if (!product) return "skipped";
  if (product.priceLocked) return "locked";

  const priced = product.supplies.filter((s) => s.cost && s.cost > 0);
  if (!priced.length) return "skipped";
  const cheapest = priced.reduce((a, b) => (b.cost! < a.cost! ? b : a));

  const p = pricer ?? (await Pricer.load());
  const rule = p.ruleFor(cheapest.supplierId, product.categoryId);
  if (!rule) return "skipped";

  const next = computePrices(rule, cheapest.cost, cheapest.listPrice);
  if (next.price <= 0) return "skipped";
  if (next.price === product.price && next.dealerPrice === product.dealerPrice) return "skipped";

  await db.product.update({
    where: { id: productId },
    data: { price: next.price, dealerPrice: next.dealerPrice, cost: cheapest.cost },
  });
  return "updated";
}

/** მთელი მიმწოდებლის პროდუქტების გადათვლა — წესის შეცვლის მერე */
export async function repriceSupplier(supplierId: string) {
  const supplies = await db.productSupply.findMany({
    where: { supplierId },
    select: { productId: true },
  });
  const pricer = await Pricer.load();
  const stats = { updated: 0, locked: 0, skipped: 0 };
  for (const s of supplies) stats[await repriceProduct(s.productId, pricer)]++;
  return stats;
}
