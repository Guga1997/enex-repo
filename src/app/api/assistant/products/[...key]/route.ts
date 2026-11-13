import { authorize, getProduct, json, langOf } from "@/lib/assistant";

export const dynamic = "force-dynamic";

/**
 * GET /api/assistant/products/{id ან SKU} — ერთი პროდუქტი სრულად: აღწერა, ყველა
 * მახასიათებელი, ფოტოები, დოკუმენტები. კოდში „/“ შეიძლება იყოს („NP65-12/G“), ამიტომ
 * მისამართის დარჩენილი ნაწილი მთლიანად კოდად ითვლება.
 */
/** Next პარამეტრს უკვე გაშიფრულს აწვდის; „%“ კოდში decodeURIComponent-ს შეცდომით აგდებს */
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const denied = authorize(req);
  if (denied) return denied;

  const { key } = await params;
  const product = await getProduct(key.map(decode).join("/"), langOf(new URL(req.url)));
  return product ? json(product) : json({ error: "პროდუქტი ვერ მოიძებნა" }, 404);
}
