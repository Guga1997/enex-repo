import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";
import { LOCALES, withLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

/**
 * მთავარი, კატეგორიები, აქტიური პროდუქტები, საინფორმაციო გვერდები —
 * სამივე ენაზე, ურთიერთმიმართებით (hreflang alternates), რომ Google-მა
 * ქართული, ინგლისური და რუსული ვერსია ერთ გვერდად ჩათვალოს.
 */
type Entry = { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number; lastModified?: Date };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([
    db.category.findMany({ where: { isActive: true }, select: { slug: true, parentId: true } }),
    db.product.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
  ]);

  const statics = ["about", "delivery", "payment", "warranty", "returns", "privacy"];

  const entries: Entry[] = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/catalog", changeFrequency: "daily", priority: 0.9 },
    { path: "/generators", changeFrequency: "daily", priority: 0.8 },
    { path: "/hotel", changeFrequency: "daily", priority: 0.8 },
    ...categories.map((c) => ({
      path: `/catalog/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: c.parentId ? 0.7 : 0.8,
    })),
    ...products.map((p) => ({
      path: `/product/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...statics.map((s) => ({ path: `/page/${s}`, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];

  return entries.flatMap((e) => {
    const languages = Object.fromEntries(LOCALES.map((l) => [l, SITE_URL + withLocale(e.path, l)]));
    return LOCALES.map((l) => ({
      url: SITE_URL + withLocale(e.path, l),
      lastModified: e.lastModified,
      changeFrequency: e.changeFrequency,
      priority: l === "ka" ? e.priority : e.priority * 0.9,
      alternates: { languages },
    }));
  });
}
