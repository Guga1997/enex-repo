import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/** პირადი და ტექნიკური გვერდები ინდექსში არ უნდა მოხვდეს */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/cart", "/checkout", "/account", "/order", "/login", "/register", "/verify", "/payment"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
