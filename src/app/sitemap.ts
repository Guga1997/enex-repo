import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** მთავარი, კატეგორიები, აქტიური პროდუქტები, საინფორმაციო გვერდები */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([
    db.category.findMany({ where: { isActive: true }, select: { slug: true, parentId: true } }),
    db.product.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
  ]);

  const statics = ["about", "delivery", "payment", "warranty", "returns", "privacy"];

  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/catalog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/generators`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/hotel`, changeFrequency: "daily", priority: 0.8 },
    ...categories.map((c) => ({
      url: `${SITE_URL}/catalog/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: c.parentId ? 0.7 : 0.8,
    })),
    ...products.map((p) => ({
      url: `${SITE_URL}/product/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...statics.map((s) => ({ url: `${SITE_URL}/page/${s}`, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
