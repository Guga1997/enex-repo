import { authorize, json, langOf, parseLimit, searchProducts } from "@/lib/assistant";

export const dynamic = "force-dynamic";

/**
 * GET /api/assistant/products?q=…&category=…&inStock=1&limit=10&lang=ka
 *
 * ძებნა AI ასისტენტისთვის — იგივე, რაც საიტის ძებნა (სინონიმები, შესაბამისობით დალაგება,
 * მარაგში მყოფი წინ), პლუს მახასიათებლების მნიშვნელობები. რამდენიმე სიტყვა — ყველა უნდა
 * ემთხვეოდეს. category — კატეგორიის slug (ან ზუსტი სახელი), ქვეკატეგორიების ჩათვლით.
 */
export async function GET(req: Request) {
  const denied = authorize(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const inStock = url.searchParams.get("inStock");
  const result = await searchProducts({
    q: url.searchParams.get("q") ?? undefined,
    category: url.searchParams.get("category")?.trim() || undefined,
    inStock: inStock === "1" || inStock === "true",
    limit: parseLimit(url.searchParams.get("limit")),
    lang: langOf(url),
  });
  if ("error" in result) return json({ error: result.error }, 404);
  return json(result);
}
