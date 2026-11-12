import { test } from "node:test";
import assert from "node:assert/strict";
import { sitemapIndex, urlset } from "../src/lib/sitemap";
// საიტის მისამართი გარემოზეა დამოკიდებული (.env) — ტესტი ნებისმიერზე გადის
import { SITE_URL as U } from "../src/lib/seo";

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const count = (xml: string, part: string) => xml.split(part).length - 1;

test("sitemap: ერთი გვერდი სამ ენაზე იწერება, თითო ყველა ენის ბმულით", () => {
  const xml = urlset([{ path: "/catalog/kamerebi", changefreq: "daily", priority: 0.7 }]);
  assert.deepEqual(locs(xml), [`${U}/catalog/kamerebi`, `${U}/en/catalog/kamerebi`, `${U}/ru/catalog/kamerebi`]);
  // 3 <url> × (3 ენა + x-default)
  assert.equal(count(xml, "hreflang="), 12);
  assert.equal(count(xml, `hreflang="x-default" href="${U}/catalog/kamerebi"`), 3);
  assert.equal(count(xml, `hreflang="ru" href="${U}/ru/catalog/kamerebi"`), 3);
  // ქართული სრული პრიორიტეტით, თარგმანი 10%-ით ნაკლებით
  assert.deepEqual([...xml.matchAll(/<priority>([^<]+)</g)].map((m) => m[1]), ["0.7", "0.63", "0.63"]);
});

test("sitemap: მთავარი გვერდი ენის პრეფიქსით — /en, არა /en/", () => {
  const xml = urlset([{ path: "/", changefreq: "daily", priority: 1 }]);
  assert.deepEqual(locs(xml), [`${U}/`, `${U}/en`, `${U}/ru`]);
});

test("sitemap: სპეციალური სიმბოლო მისამართში XML-ს არ არღვევს", () => {
  const xml = urlset([
    { path: "/product/a&b<c", changefreq: "weekly", priority: 0.6, lastmod: new Date("2026-11-12T00:00:00Z") },
  ]);
  assert.ok(xml.includes(`<loc>${U}/product/a&amp;b&lt;c</loc>`));
  assert.ok(xml.includes("<lastmod>2026-11-12T00:00:00.000Z</lastmod>"));
});

test("sitemap: ინდექსი ყველა ნაწილს ჩამოთვლის", () => {
  const xml = sitemapIndex(["pages", "categories", "products-1"], new Date("2026-11-12T00:00:00Z"));
  assert.deepEqual(locs(xml), [
    `${U}/sitemaps/pages.xml`,
    `${U}/sitemaps/categories.xml`,
    `${U}/sitemaps/products-1.xml`,
  ]);
});
