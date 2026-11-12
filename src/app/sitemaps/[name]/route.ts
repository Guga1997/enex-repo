import { sitemapPartResponse } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/** /sitemaps/pages.xml, /sitemaps/categories.xml, /sitemaps/products-1.xml … */
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!name.endsWith(".xml")) return new Response("Not found", { status: 404 });
  return sitemapPartResponse(name.slice(0, -4), req);
}
