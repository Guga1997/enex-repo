import { authorize, categoryTree, json, langOf } from "@/lib/assistant";

export const dynamic = "force-dynamic";

/** GET /api/assistant/categories — კატეგორიების ხე, თითოეულში ხილული პროდუქტების რაოდენობით */
export async function GET(req: Request) {
  const denied = authorize(req);
  if (denied) return denied;
  return json({ categories: await categoryTree(langOf(new URL(req.url))) });
}
