import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { PREFIXED } from "@/lib/i18n/config";

const PRIVATE = [
  "/admin", "/api", "/cart", "/checkout", "/account", "/order", "/orders", "/login", "/register",
  "/verify", "/forgot", "/reset", "/payment", "/stats", "/stock",
];

/** პირადი და ტექნიკური გვერდები ინდექსში არ უნდა მოხვდეს */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // ენის ვერსიებიც (/en/cart, /ru/login…) — თორემ ინდექსში ხვდებოდა
      disallow: PRIVATE.flatMap((p) => [p, ...PREFIXED.map((l) => `/${l}${p}`)]),
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
