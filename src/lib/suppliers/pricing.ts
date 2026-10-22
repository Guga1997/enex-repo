import { db } from "../db";

/**
 * ფასწარმოქმნა მიმწოდებლის მონაცემებიდან.
 *
 *   ზოგი მიმწოდებელი **ერთ** ფასს აგზავნის, რომელშიც ჩვენი ფასდაკლება უკვე დევს
 *   (რომსატი — ცვალებადი, მაგრამ არანაკლებ 10%). supplierDiscount სწორედ ამას
 *   ითვალისწინებს: ნამდვილი თვითღირებულება გამოგზავნილ ფასზე დაბლაა, საცალო კი
 *   იმავე ადგილას რჩება — ანუ მოგება ჩანს ისეთი, როგორიც სინამდვილეშია.
 *
 *   ორ ფასს თუ იძლევა (ინტელკომი: სადილერო + საცალო), ვარაუდი ზედმეტია —
 *   სადილერო უკვე ჩვენი თვითღირებულებაა და ფასდაკლება არ ედება.
 *
 *   თვითღირებულება = გამოგზავნილი ფასი × (1 − supplierDiscount%)
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

/** მიმწოდებლის კომერციული პირობები — სეგმენტს არ მიჰყვება */
export type SupplierTerms = { supplierDiscount: number; minMargin: number };
const NO_TERMS: SupplierTerms = { supplierDiscount: 0, minMargin: 0 };

/** გამოგზავნილი ფასიდან ნამდვილი თვითღირებულება */
export function realCost(
  quoted: number | null | undefined,
  discountPercent = 0,
  listPrice?: number | null
): number | null {
  if (!quoted || quoted <= 0) return null;
  // ორფასიანი მიმწოდებელი სადილეროსაც და საცალოსაც გვაძლევს — სადილერო უკვე
  // ჩვენი თვითღირებულებაა და ვარაუდი ზედმეტია. ფასდაკლება მხოლოდ მაშინ ედება,
  // როცა ერთი ფასი მოვიდა და არ ვიცით, რამდენი დევს მასში ჩვენთვის.
  if (listPrice != null && listPrice > quoted) return Math.round(quoted * 100) / 100;
  const d = Math.min(Math.max(discountPercent, 0), 90) / 100;
  return Math.round(quoted * (1 - d) * 100) / 100;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computePrices(
  rule: PricingRule,
  cost: number | null | undefined,
  listPrice: number | null | undefined,
  terms: SupplierTerms = NO_TERMS
): { price: number; dealerPrice: number | null; cost: number | null } {
  const quoted = cost && cost > 0 ? cost : null;
  const list = listPrice && listPrice > 0 ? listPrice : null;
  const c = realCost(quoted, terms.supplierDiscount, listPrice);
  const dealerPrice = c ? round2(c * (1 + rule.markupDealer / 100)) : null;

  let price = 0;
  const byMargin = rule.retailBase === "MARGIN" && list !== null && c !== null && list > c;
  if (byMargin) {
    // მოგების წილი: მისი საცალო მინუს მოგების N%. ანუ ყოველთვის მასზე იაფად,
    // ხოლო რამდენად — ეს თვითონ პროდუქტის მოგებაზეა დამოკიდებული და არა
    // ფიქსირებულ პროცენტზე, რომელიც თხელმარჟიანს ზარალში ჩააგდებდა.
    price = round2(list - (rule.markupRetail / 100) * (list - c));
  } else {
    // საცალო გამოგზავნილ ფასს მიჰყვება — ფასდაკლების აღიარებამ ფასი არ უნდა ჩამოწიოს
    const base = rule.retailBase === "LIST" && list !== null ? list : quoted;
    price = base ? round2(base * (1 + rule.markupRetail / 100)) : 0;
  }

  // იატაკი ერთია და ყველა რეჟიმს ეხება: თვითღირებულებაზე დაბლა არასდროს,
  // minMargin კი მას ზემოთ წევს. ძველი „სადილეროზე დაბლა არა“ (ქოსთი ×
  // (1 + markupDealer)) ამოღებულია — ფანჯარაში აღარ ჩანდა, ფასს კი მაინც
  // აწევდა და „მოგების წილით“ რეჟიმში მიმწოდებლის საცალოზე მაღლაც ადიოდა.
  if (c !== null) price = Math.max(price, round2(c * (1 + Math.max(terms.minMargin, 0) / 100)));

  return { price, dealerPrice, cost: c };
}

/**
 * წესების ერთჯერადი ჩატვირთვა — ათას პროდუქტზე ათასჯერ კატეგორიების ხეს არ ვკითხულობთ.
 * ერთი სინქის ან ერთი გადათვლის სიცოცხლისთვისაა.
 */
export class Pricer {
  private constructor(
    private parents: Map<string, string | null>,
    private rules: Map<string, PricingRule>, // `${supplierId}:${categoryId}`
    private defaults: Map<string, PricingRule>, // supplierId
    private terms: Map<string, SupplierTerms> // supplierId
  ) {}

  /** მიმწოდებლის კომერციული პირობები — სეგმენტს არ მიჰყვება */
  termsFor(supplierId: string): SupplierTerms {
    return this.terms.get(supplierId) ?? NO_TERMS;
  }

  /** მიმწოდებლის ფასში უკვე ჩადებული ფასდაკლება */
  discountFor(supplierId: string): number {
    return this.termsFor(supplierId).supplierDiscount;
  }

  static async load(): Promise<Pricer> {
    const [cats, rules, suppliers] = await Promise.all([
      db.category.findMany({ select: { id: true, parentId: true } }),
      db.supplierPricingRule.findMany(),
      db.supplier.findMany({
        select: {
          id: true, retailBase: true, markupRetail: true, markupDealer: true,
          supplierDiscount: true, minMargin: true,
        },
      }),
    ]);
    return new Pricer(
      new Map(cats.map((c) => [c.id, c.parentId])),
      new Map(rules.map((r) => [`${r.supplierId}:${r.categoryId}`, r])),
      new Map(suppliers.map((s) => [s.id, s])),
      new Map(suppliers.map((s) => [s.id, { supplierDiscount: s.supplierDiscount, minMargin: s.minMargin }]))
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
      cost: true,
      listPrice: true,
      priceLocked: true,
      categoryId: true,
      supplies: { select: { supplierId: true, cost: true, listPrice: true } },
    },
  });
  if (!product) return "skipped";
  if (product.priceLocked) return "locked";

  const p = pricer ?? (await Pricer.load());

  // შედარება ნამდვილ თვითღირებულებაზე — მიმწოდებელს, რომელიც ფასდაკლებას გვაძლევს,
  // გამოგზავნილი ფასით ვერ შევადარებთ
  const priced = product.supplies
    .filter((s) => s.cost && s.cost > 0)
    .map((s) => ({ ...s, real: realCost(s.cost, p.discountFor(s.supplierId), s.listPrice)! }));
  if (!priced.length) return "skipped";
  const cheapest = priced.reduce((a, b) => (b.real < a.real ? b : a));

  const rule = p.ruleFor(cheapest.supplierId, product.categoryId);
  if (!rule) return "skipped";

  const next = computePrices(rule, cheapest.cost, cheapest.listPrice, p.termsFor(cheapest.supplierId));
  if (next.price <= 0) return "skipped";
  // თვითღირებულებაც უნდა შეესაბამებოდეს იმ მიმწოდებელს, რომლითაც ფასი დაითვალა —
  // თორემ ბოლოს დასინქრონებული კომპანიის cost რჩება და „ფასი < თვითღირებულება“ ჩანს
  const sameCost = product.cost === next.cost;

  // მიმწოდებლის საცალო მხოლოდ „მოგების წილით“ დაფასებულზე ინახება — სწორედ ის
  // არის პარტნიორების საფეხურების ბაზა. სხვა რეჟიმში საფეხური ჩვენი საცალოდან ითვლება.
  const list =
    rule.retailBase === "MARGIN" && cheapest.listPrice && next.cost && cheapest.listPrice > next.cost
      ? cheapest.listPrice
      : null;

  if (
    next.price === product.price &&
    next.dealerPrice === product.dealerPrice &&
    sameCost &&
    list === product.listPrice
  )
    return "skipped";

  await db.product.update({
    where: { id: productId },
    data: { price: next.price, dealerPrice: next.dealerPrice, cost: next.cost, listPrice: list },
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
