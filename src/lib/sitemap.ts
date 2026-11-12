import { gzipSync } from "node:zlib";
import { db } from "./db";
import { SITE_URL } from "./seo";
import { LOCALES, withLocale } from "./i18n/config";

/**
 * Sitemap ნაწილებად: /sitemap.xml ინდექსია, თითო ნაწილი /sitemaps/<სახელი>.xml.
 *
 * ერთი ფაილი 10 MB გამოდიოდა (14 000 მისამართი × სამი ენის hreflang) და შეუკუმშავად
 * იგზავნებოდა — ჩამოტვირთვას ~10 წამი სჭირდებოდა. ახლა ნაწილი ≤ PRODUCTS_PER_FILE
 * პროდუქტია, პასუხი gzip-ით იკუმშება და 10 წუთი ინახება მეხსიერებაში.
 *
 * თითო გვერდი სამივე ენაზე, ურთიერთმიმართებით (hreflang), რომ Google-მა ქართული,
 * ინგლისური და რუსული ვერსია ერთ გვერდად ჩათვალოს.
 */

export const PRODUCTS_PER_FILE = 1000;
const TTL_MS = 10 * 60_000;

type Entry = { path: string; changefreq: string; priority: number; lastmod?: Date };

const STATICS = ["about", "delivery", "payment", "warranty", "returns", "privacy", "terms"];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** ერთი გვერდი → სამი <url> (თითო ენაზე), თითოეულში ყველა ენის ბმული */
export function urlset(entries: Entry[]): string {
  const out: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
  ];
  for (const e of entries) {
    const links =
      LOCALES.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${esc(SITE_URL + withLocale(e.path, l))}" />`).join("\n") +
      `\n<xhtml:link rel="alternate" hreflang="x-default" href="${esc(SITE_URL + e.path)}" />`;
    for (const l of LOCALES) {
      const priority = l === "ka" ? e.priority : Math.round(e.priority * 90) / 100;
      out.push(
        `<url>\n<loc>${esc(SITE_URL + withLocale(e.path, l))}</loc>\n${links}\n` +
          (e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>\n` : "") +
          `<changefreq>${e.changefreq}</changefreq>\n<priority>${priority}</priority>\n</url>`
      );
    }
  }
  out.push(`</urlset>`);
  return out.join("\n");
}

export function sitemapIndex(names: string[], lastmod: Date): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...names.map(
      (n) => `<sitemap>\n<loc>${esc(`${SITE_URL}/sitemaps/${n}.xml`)}</loc>\n<lastmod>${lastmod.toISOString()}</lastmod>\n</sitemap>`
    ),
    `</sitemapindex>`,
  ].join("\n");
}

/** ინდექსში ჩანს მხოლოდ ის, რაც საიტზეც იხსნება: ჩართული პროდუქტი ჩართულ კატეგორიაში */
const VISIBLE = { isActive: true, category: { isActive: true } } as const;

async function productFiles(): Promise<number> {
  return Math.max(1, Math.ceil((await db.product.count({ where: VISIBLE })) / PRODUCTS_PER_FILE));
}

/** ნაწილების სახელები: pages, categories, products-1 … products-N */
export async function sitemapNames(): Promise<string[]> {
  const n = await productFiles();
  return ["pages", "categories", ...Array.from({ length: n }, (_, i) => `products-${i + 1}`)];
}

async function build(name: string): Promise<string | null> {
  if (name === "pages") {
    return urlset([
      { path: "/", changefreq: "daily", priority: 1 },
      { path: "/catalog", changefreq: "daily", priority: 0.9 },
      { path: "/sale", changefreq: "daily", priority: 0.8 },
      { path: "/generators", changefreq: "daily", priority: 0.8 },
      { path: "/hotel", changefreq: "daily", priority: 0.8 },
      ...STATICS.map((s) => ({ path: `/page/${s}`, changefreq: "monthly", priority: 0.3 })),
    ]);
  }
  if (name === "categories") {
    // მშობელი გამორთულია — ქვეკატეგორიაც და მისი პროდუქტებიც 404-ზე მიდის
    const cats = await db.category.findMany({
      where: { isActive: true, OR: [{ parentId: null }, { parent: { isActive: true } }] },
      select: { slug: true, parentId: true },
      orderBy: { slug: "asc" },
    });
    return urlset(cats.map((c) => ({ path: `/catalog/${c.slug}`, changefreq: "daily", priority: c.parentId ? 0.7 : 0.8 })));
  }
  const m = /^products-([1-9]\d{0,3})$/.exec(name);
  if (!m) return null;
  const page = Number(m[1]);
  if (page > (await productFiles())) return null;
  // id-ით დალაგება: ნაწილებს შორის პროდუქტი არ „გადახტება“, როცა სინქრონიზაცია updatedAt-ს ცვლის
  const products = await db.product.findMany({
    where: VISIBLE,
    select: { slug: true, updatedAt: true },
    orderBy: { id: "asc" },
    skip: (page - 1) * PRODUCTS_PER_FILE,
    take: PRODUCTS_PER_FILE,
  });
  return urlset(products.map((p) => ({ path: `/product/${p.slug}`, lastmod: p.updatedAt, changefreq: "weekly", priority: 0.6 })));
}

type Cached = { at: number; xml: Buffer; gz: Buffer };
const cache = new Map<string, Cached>();

async function cached(key: string, make: () => Promise<string | null>): Promise<Cached | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  const xml = await make();
  if (xml === null) return null;
  const buf = Buffer.from(xml, "utf8");
  const entry = { at: Date.now(), xml: buf, gz: gzipSync(buf) };
  cache.set(key, entry);
  return entry;
}

/** XML პასუხი; gzip-ით, თუ მომთხოვნი იღებს (Googlebot იღებს) */
function respond(c: Cached, req: Request): Response {
  const gz = /\bgzip\b/i.test(req.headers.get("accept-encoding") ?? "");
  return new Response(new Uint8Array(gz ? c.gz : c.xml), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
      Vary: "Accept-Encoding",
      ...(gz ? { "Content-Encoding": "gzip" } : {}),
    },
  });
}

export async function sitemapIndexResponse(req: Request): Promise<Response> {
  const c = await cached("index", async () => sitemapIndex(await sitemapNames(), new Date()));
  return respond(c!, req);
}

export async function sitemapPartResponse(name: string, req: Request): Promise<Response> {
  const c = await cached(name, () => build(name));
  return c ? respond(c, req) : new Response("Not found", { status: 404 });
}
