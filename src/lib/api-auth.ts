import { createHash, randomBytes } from "crypto";
import { db } from "./db";

/** გასაღებს ვინახავთ მხოლოდ hash-ად; ღია ტექსტი ერთხელ ჩანს შექმნისას. */
export function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey() {
  const raw = `sk_live_${randomBytes(24).toString("hex")}`;
  return { raw, hash: hashKey(raw), prefix: raw.slice(0, 16) };
}

export type ApiAuthResult =
  | { ok: true; keyId: string; keyName: string; scopes: string[] }
  | { ok: false; status: 401 | 403; error: string };

/**
 * ავთენტიფიკაცია `Authorization: Bearer <key>` ან `X-API-Key: <key>` ჰედერით.
 */
export async function authenticateApiKey(
  req: Request,
  requiredScope: string
): Promise<ApiAuthResult> {
  const header = req.headers.get("authorization");
  const raw = header?.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : req.headers.get("x-api-key")?.trim();

  if (!raw) return { ok: false, status: 401, error: "API გასაღები არ არის მითითებული" };

  const record = await db.apiKey.findUnique({ where: { keyHash: hashKey(raw) } });
  if (!record || !record.isActive)
    return { ok: false, status: 401, error: "არავალიდური API გასაღები" };

  const scopes = record.scopes.split(",").map((s) => s.trim());
  if (!scopes.includes(requiredScope))
    return { ok: false, status: 403, error: `საჭიროა უფლება: ${requiredScope}` };

  await db.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return { ok: true, keyId: record.id, keyName: record.name, scopes };
}
