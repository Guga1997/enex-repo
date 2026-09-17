import { db } from "../db";

/**
 * ფასწარმოქმნა მიმწოდებლის მონაცემებიდან.
 *
 *   სადილერო = თვითღირებულება × (1 + markupDealer%)         — ყოველთვის მასზე მაღლა
 *   საცალო   = ბაზა × (1 + markupRetail%), სადაც ბაზა:
 *              COST — თვითღირებულება (ჩვეულებრივი ფასდადება, +30)
 *              LIST — მიმწოდებლის საცალო ფასი (მასზე დაბლა — უარყოფითი %, −5)
 *
 * ხელით შეცვლილ ფასს (priceLocked) არც სინქი ეხება, არც გადათვლა.
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
 * პროდუქტის ფასი ყველა მიმწოდებლიდან — ყველაზე იაფი წყაროს წესით.
 * აბრუნებს, შეიცვალა თუ არა რამე. ჩაკეტილს არ ეხება.
 */
export async function repriceProduct(productId: string): Promise<"updated" | "locked" | "skipped"> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      price: true,
      dealerPrice: true,
      priceLocked: true,
      supplies: {
        select: {
          cost: true,
          listPrice: true,
          supplier: { select: { retailBase: true, markupRetail: true, markupDealer: true } },
        },
      },
    },
  });
  if (!product) return "skipped";
  if (product.priceLocked) return "locked";

  const priced = product.supplies.filter((s) => s.cost && s.cost > 0);
  if (!priced.length) return "skipped";
  const cheapest = priced.reduce((a, b) => (b.cost! < a.cost! ? b : a));

  const next = computePrices(cheapest.supplier, cheapest.cost, cheapest.listPrice);
  if (next.price <= 0) return "skipped";
  if (next.price === product.price && next.dealerPrice === product.dealerPrice) return "skipped";

  await db.product.update({
    where: { id: productId },
    data: { price: next.price, dealerPrice: next.dealerPrice, cost: cheapest.cost },
  });
  return "updated";
}

/** მთელი მიმწოდებლის პროდუქტების გადათვლა — პროცენტის ან ბაზის შეცვლის მერე */
export async function repriceSupplier(supplierId: string) {
  const supplies = await db.productSupply.findMany({
    where: { supplierId },
    select: { productId: true },
  });
  const stats = { updated: 0, locked: 0, skipped: 0 };
  for (const s of supplies) stats[await repriceProduct(s.productId)]++;
  return stats;
}
