import { sitemapIndexResponse } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/** /sitemap.xml — ინდექსი; ნაწილები /sitemaps/<სახელი>.xml-ზეა (იხ. src/lib/sitemap.ts) */
export function GET(req: Request) {
  return sitemapIndexResponse(req);
}
