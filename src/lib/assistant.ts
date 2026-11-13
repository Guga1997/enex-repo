import { createHash, timingSafeEqual } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { buildWhere, categoryIdsWithDescendants, fixTypos, type CatalogQuery } from "./catalog";
import { getCategoryTree, type TreeNode } from "./category-tree";
import { rankIds } from "./search-rank";
import { searchTerms } from "./search-terms";
import { ci, ciEquals } from "./search-mode";
import { availableQty, isPurchasable, stockLabel } from "./stock";
import { abs, clip, realBrand, CONTACT, SITE_URL } from "./seo";
import { descriptionOf, nameOf, plainText } from "./i18n/content";
import { translate } from "./i18n/dict";
import { translateAttr } from "./i18n/attributes";
import { isLocale, withLocale, type Locale } from "./i18n/config";
import { rateLimit } from "./rate-limit";
import { DELIVERY_FEE, FREE_DELIVERY_FROM } from "./constants";
import { PAGES } from "@/content/pages";

/**
 * AI ასისტენტის (ჩატბოტის) API — /api/assistant/*. მხოლოდ კითხვა.
 *
 * ბოტი ყოველ შეკითხვაზე აქ ცოცხლად ეძებს, ამიტომ ქეში არ არის: ადმინში შეცვლილი ფასი,
 * დამატებული ან გათიშული პროდუქტი შემდეგივე მოთხოვნაზე ჩანს.
 *
 * გარეთ გადის მხოლოდ ის, რასაც სტუმარი საიტზე ხედავს. ხილვადობა კატალოგის იდენტურია
 * (buildWhere): ჩართული პროდუქტი, ფასით, ჩართულ კატეგორიაში. თვითღირებულება, სადილერო
 * ფასი, მიმწოდებელი და მისი მონაცემები select-შიც კი არ იტვირთება — იხ. SELECT ქვემოთ და
 * tests/assistant.test.ts, რომელიც გამოსული ველების სიას ამოწმებს.
 */

/* ───────────────────────────── წვდომა ───────────────────────────── */

const RATE = { limit: 120, windowMs: 60_000 };
/** არასწორი გასაღებით მცდელობები ერთი IP-დან — გამოცნობის წინააღმდეგ */
const BAD_KEY_RATE = { limit: 20, windowMs: 60_000 };

const sha = (s: string) => createHash("sha256").update(s).digest();

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

/**
 * `Authorization: Bearer <ASSISTANT_API_KEY>`. null — წვდომა ნებადართულია.
 * გასაღები .env-შია; თუ არ არის დაყენებული ან მოკლეა, ყველას უარი ეთქმება (დახურული რჩება).
 */
export function authorize(req: Request): Response | null {
  const expected = process.env.ASSISTANT_API_KEY?.trim() ?? "";
  const header = req.headers.get("authorization") ?? "";
  const given = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : "";
  // hash-ების შედარება: სიგრძე ერთნაირია და დრო გასაღებზე არ არის დამოკიდებული
  const ok = expected.length >= 32 && given.length > 0 && timingSafeEqual(sha(given), sha(expected));
  if (!ok) {
    const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const r = rateLimit(`assistant-bad:${ip}`, BAD_KEY_RATE.limit, BAD_KEY_RATE.windowMs);
    if (!r.ok) return json({ error: "ძალიან ბევრი მცდელობა" }, 429, { "Retry-After": String(r.retryAfterSec) });
    return json({ error: "საჭიროა გასაღები: Authorization: Bearer <ASSISTANT_API_KEY>" }, 401, {
      "WWW-Authenticate": "Bearer",
    });
  }
  const r = rateLimit("assistant", RATE.limit, RATE.windowMs);
  if (!r.ok)
    return json({ error: `ლიმიტი: ${RATE.limit} მოთხოვნა წუთში` }, 429, { "Retry-After": String(r.retryAfterSec) });
  return null;
}

export const langOf = (url: URL): Locale => {
  const l = url.searchParams.get("lang") ?? "";
  return isLocale(l) ? l : "ka";
};

/* ───────────────────────────── პროდუქტი ───────────────────────────── */

/** მხოლოდ საჯარო ველები. cost / dealerPrice / listPrice / supplies აქ არ უნდა გაჩნდეს. */
const SELECT = {
  id: true, sku: true, slug: true, model: true,
  nameKa: true, nameEn: true, nameRu: true,
  descriptionKa: true, descriptionEn: true, descriptionRu: true,
  price: true, oldPrice: true,
  stockQty: true, reservedQty: true, stockStatus: true, incomingDate: true,
  minQty: true, qtyStep: true, unit: true, lowStockAt: true,
  warrantyMonths: true, weightKg: true, isNew: true, updatedAt: true,
  categoryId: true,
  brand: { select: { name: true } },
  images: { orderBy: { sortOrder: "asc" }, select: { url: true } },
  attributes: { orderBy: { sortOrder: "asc" }, select: { name: true, value: true } },
  documents: { orderBy: { sortOrder: "asc" }, select: { title: true, url: true, kind: true } },
} satisfies Prisma.ProductSelect;

type Row = Prisma.ProductGetPayload<{ select: typeof SELECT }>;

const STATUS: Record<string, string> = {
  IN_STOCK: "in_stock",
  OUT_OF_STOCK: "out_of_stock",
  IN_TRANSIT: "in_transit",
  PREORDER: "preorder",
};

/** „A > B > C“ — კატეგორიის სრული გზა, მენიუს ხიდან (ჩართული კატეგორიები) */
function categoryPath(byId: Map<string, TreeNode>, id: string, locale: Locale) {
  const chain: TreeNode[] = [];
  for (let n = byId.get(id), i = 0; n && i < 10; n = n.parentId ? byId.get(n.parentId) : undefined, i++) chain.unshift(n);
  return {
    category: chain.map((n) => nameOf(n, locale)).join(" > "),
    categorySlug: chain.length ? chain[chain.length - 1].slug : null,
  };
}

const SHORT_ATTRS = 8;

/** ერთი პროდუქტი ისე, როგორც სტუმარი ხედავს. full — პროდუქტის გვერდის სრული ვერსია. */
export function present(p: Row, byId: Map<string, TreeNode>, locale: Locale, full = false) {
  const t = (s: string, ...a: (string | number)[]) => translate(locale, s, ...a);
  const purchasable = isPurchasable(p);
  // „მარაგშია“ სტატუსი, მაგრამ ყველაფერი დაკავებულია → საიტზეც „არ გვაქვს“ წერია
  const status = p.stockStatus === "IN_STOCK" && !purchasable ? "out_of_stock" : (STATUS[p.stockStatus] ?? "out_of_stock");
  const discounted = p.oldPrice != null && p.oldPrice > p.price;
  const description = descriptionOf(p, locale);
  const attrs = p.attributes.map((a) => ({ name: translateAttr(a.name, locale), value: translateAttr(a.value, locale) }));
  const images = p.images.map((i) => abs(i.url));

  return {
    id: p.id,
    sku: p.sku,
    name: nameOf(p, locale),
    brand: realBrand(p.brand),
    model: p.model,
    ...categoryPath(byId, p.categoryId, locale),
    price: p.price,
    currency: "GEL",
    oldPrice: discounted ? p.oldPrice : null,
    discountPercent: discounted ? Math.round((1 - p.price / p.oldPrice!) * 100) : null,
    // ფასის ერთეული („მ“ — მეტრზე); ცარიელი = ცალი. მინიმუმი და ბიჯი მხოლოდ მაშინ, როცა 1 არ არის.
    unit: p.unit ?? null,
    ...(p.minQty > 1 || p.qtyStep > 1 ? { minQty: p.minQty, qtyStep: p.qtyStep } : {}),
    stock: {
      status,
      label: stockLabel(p, t).text,
      canOrder: purchasable,
      // ზუსტი რაოდენობა მხოლოდ მარაგში მყოფზე (პროდუქტის გვერდი ამდენის შეკვეთას უშვებს)
      quantity: status === "in_stock" ? availableQty(p) : null,
      expectedDate: p.stockStatus === "IN_TRANSIT" && p.incomingDate ? p.incomingDate.toISOString().slice(0, 10) : null,
    },
    isNew: p.isNew,
    warrantyMonths: p.warrantyMonths,
    shortDescription: description ? clip(description, 300) : null,
    attributes: full ? attrs : attrs.slice(0, SHORT_ATTRS),
    url: abs(withLocale(`/product/${p.slug}`, locale)),
    imageUrl: images[0] ?? null,
    updatedAt: p.updatedAt.toISOString(),
    ...(full
      ? {
          description,
          images,
          documents: p.documents.map((d) => ({ title: t(d.title), kind: d.kind, url: abs(d.url) })),
          weightKg: p.weightKg,
        }
      : {}),
  };
}

export type AssistantProduct = ReturnType<typeof present>;

/* ───────────────────────────── ძებნა ───────────────────────────── */

export const LIMIT_DEFAULT = 10;
export const LIMIT_MAX = 30;

export function parseLimit(v: string | null): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, LIMIT_MAX) : LIMIT_DEFAULT;
}

/** კატეგორია slug-ით; ვერ პოვნისას — ზუსტი სახელით (ბოტმა შეიძლება სახელი გამოგზავნოს) */
async function findCategory(key: string): Promise<{ id: string } | null> {
  const k = key.trim();
  if (!k) return null;
  const bySlug = await db.category.findFirst({ where: { slug: k.toLowerCase(), isActive: true }, select: { id: true } });
  if (bySlug) return bySlug;
  const { byId } = await getCategoryTree();
  const low = k.toLowerCase();
  for (const n of byId.values())
    if ([n.nameKa, n.nameEn, n.nameRu].some((x) => x?.trim().toLowerCase() === low)) return { id: n.id };
  return null;
}

/** დასალაგებლად საჭირო მსუბუქი ველები — ყველა დამთხვევაზე იტვირთება */
const RANK_SELECT = {
  id: true, sku: true, model: true, nameKa: true, nameEn: true, nameRu: true,
  price: true, sortOrder: true, stockStatus: true, stockQty: true, reservedQty: true, minQty: true,
  brand: { select: { name: true } },
  category: {
    select: {
      nameKa: true, nameEn: true, nameRu: true,
      parent: { select: { nameKa: true, nameEn: true, nameRu: true } },
    },
  },
} satisfies Prisma.ProductSelect;

/**
 * საიტის ძებნა (სინონიმები, ფუძეები, შესაბამისობით დალაგება) + მახასიათებლების
 * მნიშვნელობები: „4მპ“, „PoE“, „IP67“ სახელში რომ არ ეწეროს, მახასიათებლით იპოვება.
 */
function textWhere(q: string): Prisma.ProductWhereInput[] {
  return searchTerms(q).map(({ variants }) => ({
    OR: variants.flatMap((v) => [
      { nameKa: ci(v) },
      { nameEn: ci(v) },
      { nameRu: ci(v) },
      { model: ci(v) },
      { sku: ci(v) },
      { category: { nameKa: ci(v) } },
      { category: { nameEn: ci(v) } },
      { category: { nameRu: ci(v) } },
      { brand: { name: ci(v) } },
      { attributes: { some: { value: ci(v) } } },
    ]),
  }));
}

export type SearchInput = { q?: string; category?: string; inStock?: boolean; limit?: number; lang?: Locale };

export async function searchProducts(input: SearchInput) {
  const locale = input.lang ?? "ka";
  const limit = input.limit ?? LIMIT_DEFAULT;
  const asked = input.q?.replace(/\s+/g, " ").trim().slice(0, 200) || undefined;

  let categoryIds: string[] = [];
  if (input.category) {
    const cat = await findCategory(input.category);
    if (!cat) return { error: `კატეგორია „${input.category}“ ვერ მოიძებნა — სია: /api/assistant/categories` as const };
    categoryIds = await categoryIdsWithDescendants(cat.id);
  }

  const base: CatalogQuery = {
    categoryIds, brands: [], statuses: input.inStock ? ["IN_STOCK"] : [],
    discount: false, isNew: false, sort: "default", page: 1, attrs: {},
  };
  const whereFor = (q?: string): Prisma.ProductWhereInput => ({
    AND: [buildWhere(base), ...(q ? textWhere(q) : [])],
  });

  // „hikvison“ → „hikvision“: ნული შედეგის ნაცვლად ყველაზე ახლო ბრენდი/კატეგორია — როგორც საიტზე
  let q = asked;
  let rows = await db.product.findMany({ where: whereFor(q), select: RANK_SELECT });
  if (q && !rows.length) {
    const fixed = (await fixTypos({ ...base, q })).q;
    if (fixed && fixed !== q) {
      q = fixed;
      rows = await db.product.findMany({ where: whereFor(q), select: RANK_SELECT });
    }
  }
  // მარაგში „არის“ მხოლოდ ის, რისი ყიდვაც მართლა შეიძლება (დაკავებული არ ითვლება)
  if (input.inStock) rows = rows.filter((r) => isPurchasable(r));

  const ids = rankIds(rows, q ?? "").slice(0, limit);
  const [full, tree] = await Promise.all([
    db.product.findMany({ where: { id: { in: ids } }, select: SELECT }),
    getCategoryTree(),
  ]);
  const byId = new Map(full.map((p) => [p.id, p]));

  return {
    query: asked ?? null,
    ...(q !== asked ? { correctedQuery: q } : {}),
    total: rows.length,
    count: ids.length,
    items: ids.flatMap((id) => {
      const p = byId.get(id);
      return p ? [present(p, tree.byId, locale)] : [];
    }),
  };
}

/** ერთი პროდუქტი id-ით ან კოდით (SKU). უხილავი პროდუქტი — null, თითქოს არ არსებობდეს. */
export async function getProduct(key: string, locale: Locale) {
  const k = key.trim();
  if (!k) return null;
  const visible = buildWhere({
    categoryIds: [], brands: [], statuses: [], discount: false, isNew: false, sort: "default", page: 1, attrs: {},
  });
  const find = (where: Prisma.ProductWhereInput) =>
    db.product.findFirst({ where: { AND: [visible, where] }, select: SELECT });
  const p =
    (await find({ id: k })) ??
    (await find({ sku: k })) ??
    (await find({ sku: ciEquals(k) })) ??
    (await find({ slug: k }));
  if (!p) return null;
  const { byId } = await getCategoryTree();
  return present(p, byId, locale, true);
}

/* ───────────────────────────── კატეგორიები ───────────────────────────── */

export type CategoryOut = {
  name: string; slug: string; path: string; productCount: number; url: string; children: CategoryOut[];
};

/** მენიუს ხე: ჩართული კატეგორიები, თითოეულში ხილული პროდუქტების რაოდენობა (ქვეკატეგორიებიანად) */
export async function categoryTree(locale: Locale): Promise<CategoryOut[]> {
  const { roots } = await getCategoryTree();
  const out = (n: TreeNode, parents: string[]): CategoryOut => {
    const name = nameOf(n, locale);
    return {
      name,
      slug: n.slug,
      path: [...parents, name].join(" > "),
      productCount: n.visible,
      url: abs(withLocale(`/catalog/${n.slug}`, locale)),
      children: n.children.map((c) => out(c, [...parents, name])),
    };
  };
  return roots.map((r) => out(r, []));
}

/* ───────────────────────────── მაღაზიის ინფორმაცია ───────────────────────────── */

/**
 * დაბრუნების პოლიტიკის მოკლე შინაარსი (src/content/legal/returns.ts, 10.10.2026) — სრული
 * ტექსტი 7 ათასი სიმბოლოა და ბოტის კონტექსტს ავსებს. პოლიტიკის შეცვლისას ესეც უნდა შეიცვალოს.
 */
const RETURNS: Record<Locale, string> = {
  ka: `- ნივთის დაბრუნება შეიძლება მიღებიდან 14 კალენდარული დღის განმავლობაში, მიზეზის მითითების გარეშე (ფიზიკური პირებისთვის; იურიდიულ პირებთან — ინდივიდუალური შეთანხმებით).
- შეტყობინება: წერილი info@enex.ge-ზე შეკვეთის ნომრით, ნივთით და მიღების თარიღით. ნივთი უნდა დაბრუნდეს შეტყობინებიდან 7 კალენდარული დღის განმავლობაში — კურიერით ან პირადად.
- ნივთი უნდა იყოს სრული კომპლექტაციით. მონტაჟით, ინსტალაციით ან ხანგრძლივი გამოყენებით გამოწვეულ ღირებულების შემცირებაზე პასუხს მომხმარებელი აგებს.
- თანხა ბრუნდება სრულად (ნივთის ფასი და სტანდარტული მიწოდების საფასური), შეტყობინების მიღებიდან არაუგვიანეს 14 კალენდარული დღისა, იმავე საშუალებით, რომლითაც გადაიხადეთ.
- უკან გამოგზავნის ხარჯს მომხმარებელი ფარავს. დიდი გაბარიტის ნივთს (გენერატორი, აკუმულატორების ბატარეა, მზის პანელების პარტია) მომხმარებელი აბრუნებს საკუთარი ტრანსპორტით ან კომპანიისგან გატანას ითხოვს.
- 14-დღიანი დაბრუნება არ ვრცელდება: ინდივიდუალური შეკვეთით დამზადებულ ან მორგებულ ნივთზე (მაგ. საჭირო სიგრძეზე დაჭრილი კაბელი, შეკვეთით დაპროგრამებული სასტუმროს ბარათები და საკეტები, სპეციფიკაციით შეკვეთილი გენერატორი ან მზის სისტემა); გახსნილ დალუქულ პროგრამულ პროდუქტსა და ლიცენზიაზე; აქტივაციის კოდებსა და ონლაინ ლიცენზიებზე; სრულად გაწეულ მომსახურებაზე (მონტაჟი, კონფიგურაცია).
- ნაკლიანი, დაზიანებული ან შეცდომით მიწოდებული ნივთი: უფასო შეკეთება ან შეცვლა, ხარჯს კომპანია ფარავს. ეს უფლება მოქმედებს მიწოდებიდან 2 წლის განმავლობაში.`,
  en: `- An item can be returned within 14 calendar days of receipt, without giving a reason (for private customers; for companies — by individual agreement).
- Notice: an email to info@enex.ge with the order number, the item and the date of receipt. The item must be sent back within 7 calendar days of the notice — by courier or in person.
- The item must be complete. The customer is liable for loss of value caused by installation, mounting or prolonged use.
- The refund is full (item price and standard delivery fee), no later than 14 calendar days after the notice, by the same means of payment.
- The customer pays the cost of sending the item back. Bulky items (generators, battery banks, batches of solar panels) are returned with the customer's own transport, or pickup by the company can be requested.
- The 14-day return does not apply to: items made or adapted to individual order (e.g. cable cut to length, hotel cards and locks programmed to order, a generator or solar system ordered to specification); sealed software and licences once unsealed; activation codes and online licences; fully performed services (installation, configuration).
- Defective, damaged or wrongly delivered items: free repair or replacement at the company's expense. This right applies for 2 years from delivery.`,
  ru: `- Товар можно вернуть в течение 14 календарных дней с момента получения, без объяснения причин (для физических лиц; с юридическими лицами — по индивидуальной договорённости).
- Уведомление: письмо на info@enex.ge с номером заказа, товаром и датой получения. Товар нужно вернуть в течение 7 календарных дней после уведомления — курьером или лично.
- Товар должен быть в полной комплектации. За снижение стоимости из-за монтажа, установки или длительного использования отвечает покупатель.
- Деньги возвращаются полностью (цена товара и стандартная доставка), не позднее 14 календарных дней после уведомления, тем же способом, которым была оплата.
- Расходы на обратную отправку несёт покупатель. Крупногабаритные товары (генераторы, аккумуляторные батареи, партии солнечных панелей) возвращаются своим транспортом либо можно запросить вывоз компанией.
- 14-дневный возврат не распространяется на: товары, изготовленные или адаптированные под индивидуальный заказ (например, кабель, отрезанный по длине, запрограммированные под заказ гостиничные карты и замки, генератор или солнечная система по спецификации); вскрытое запечатанное ПО и лицензии; коды активации и онлайн-лицензии; полностью оказанные услуги (монтаж, настройка).
- Бракованный, повреждённый или ошибочно доставленный товар: бесплатный ремонт или замена за счёт компании. Это право действует 2 года с момента доставки.`,
};

const H: Record<string, Record<Locale, string>> = {
  delivery: { ka: "მიწოდება", en: "Delivery", ru: "Доставка" },
  payment: { ka: "გადახდა", en: "Payment", ru: "Оплата" },
  warranty: { ka: "გარანტია", en: "Warranty", ru: "Гарантия" },
  returns: { ka: "დაბრუნება", en: "Returns", ru: "Возврат" },
  contacts: { ka: "კონტაქტი", en: "Contacts", ru: "Контакты" },
  about: { ka: "მაღაზიის შესახებ", en: "About the store", ru: "О магазине" },
  full: { ka: "სრული ტექსტი", en: "Full text", ru: "Полный текст" },
  hours: { ka: "სამუშაო საათები", en: "Working hours", ru: "Часы работы" },
  site: { ka: "საიტი", en: "Website", ru: "Сайт" },
};

export function storeInfo(locale: Locale) {
  const page = (slug: string) => PAGES[slug]?.[locale]?.body.trim() ?? "";
  const link = (slug: string) => abs(withLocale(`/page/${slug}`, locale));
  const contacts = {
    phone: CONTACT.phone || null,
    whatsapp: null as string | null, // საიტზე WhatsApp ნომერი არ არის მითითებული
    email: CONTACT.email || null,
    address: process.env.SELLER_ADDRESS ? translate(locale, process.env.SELLER_ADDRESS) : null,
    workingHours: translate(locale, CONTACT.hours),
    website: SITE_URL,
  };
  const delivery = {
    // ერთი ტარიფი მთელ საქართველოზე — რეგიონების მიხედვით განსხვავდება მხოლოდ ვადა
    fee: DELIVERY_FEE,
    freeFrom: FREE_DELIVERY_FROM,
    currency: "GEL",
    daysTbilisi: "1-2",
    daysRegions: "2-4",
    pickup: true,
  };
  const missing = [
    !contacts.phone && "phone",
    !contacts.whatsapp && "whatsapp",
    !contacts.address && "address",
  ].filter(Boolean) as string[];

  const line = (label: string, v: string | null) => (v ? `- ${label}: ${v}` : "");
  const sections: [string, string, string?][] = [
    [H.about[locale], page("about"), link("about")],
    [H.delivery[locale], page("delivery"), link("delivery")],
    [H.payment[locale], page("payment"), link("payment")],
    [H.warranty[locale], page("warranty"), link("warranty")],
    [H.returns[locale], RETURNS[locale], link("returns")],
    [
      H.contacts[locale],
      [
        line(translate(locale, "ტელეფონი"), contacts.phone),
        line("WhatsApp", contacts.whatsapp),
        line(translate(locale, "ელფოსტა"), contacts.email),
        line(translate(locale, "მისამართი"), contacts.address),
        line(H.hours[locale], contacts.workingHours),
        line(H.site[locale], contacts.website),
      ].filter(Boolean).join("\n"),
    ],
  ];
  const markdown =
    `# Enex (enex.ge)\n\n` +
    sections
      .map(([title, body, url]) => `## ${title}\n\n${plainText(body)}${url ? `\n\n${H.full[locale]}: ${url}` : ""}`)
      .join("\n\n") +
    "\n";

  return { lang: locale, contacts, delivery, missing, markdown };
}
