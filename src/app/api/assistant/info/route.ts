import { authorize, json, langOf, storeInfo } from "@/lib/assistant";

export const dynamic = "force-dynamic";

/**
 * GET /api/assistant/info — მაღაზიის ინფორმაცია: მიწოდება, გადახდა, გარანტია, დაბრუნება,
 * კონტაქტი. JSON (markdown ველით); ?format=md — მხოლოდ markdown ტექსტი.
 */
export async function GET(req: Request) {
  const denied = authorize(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const info = storeInfo(langOf(url));
  if (url.searchParams.get("format") === "md")
    return new Response(info.markdown, {
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" },
    });
  return json(info);
}
