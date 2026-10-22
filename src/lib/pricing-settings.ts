import { db } from "./db";
import { MAX_PARTNER_SHARE, TIERS } from "./pricing";

/**
 * პარტნიორების საფეხურების წილები — „პროდუქციის ფასების“ ფანჯრიდან იცვლება.
 *
 * ბაზაში ინახება, მაგრამ ყოველ გვერდზე ხელახლა არ იკითხება: ერთი პროცესია
 * (next start), ამიტომ მეხსიერებაში ვინახავთ და შენახვისას ვანულებთ.
 * ბაზაში თუ არაფერია, კოდის ნაგულისხმევი მოქმედებს (10/20/30/40).
 */

const KEY = "tierShares";
const TTL_MS = 60_000;

export type TierShares = Record<string, number>;

const DEFAULTS: TierShares = Object.fromEntries(TIERS.map((t) => [t.code, t.share]));

let cache: { at: number; value: TierShares } | null = null;

/** წილი 0…MAX შუალედში; RETAIL ყოველთვის 0 */
function sanitize(raw: unknown): TierShares {
  const out: TierShares = { ...DEFAULTS };
  if (raw && typeof raw === "object") {
    for (const t of TIERS) {
      const v = (raw as Record<string, unknown>)[t.code];
      if (typeof v === "number" && Number.isFinite(v)) out[t.code] = Math.min(Math.max(v, 0), MAX_PARTNER_SHARE);
    }
  }
  out.RETAIL = 0;
  return out;
}

export async function getTierShares(): Promise<TierShares> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value = DEFAULTS;
  try {
    const row = await db.setting.findUnique({ where: { key: KEY } });
    value = row ? sanitize(JSON.parse(row.value)) : { ...DEFAULTS };
  } catch {
    // ბაზა რომ ვერ წავიკითხოთ, ფასდაკლება მაინც ნაგულისხმევით იმუშავებს
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function saveTierShares(shares: TierShares) {
  const clean = sanitize(shares);
  await db.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(clean) },
    update: { value: JSON.stringify(clean) },
  });
  cache = { at: Date.now(), value: clean };
  return clean;
}

/** მომხმარებლის საფეხურის წილი — viewer-ზე ერთხელ ვაწერთ, რომ ფასი სინქრონულად ითვლებოდეს */
export async function shareFor(priceTier: string): Promise<number> {
  return (await getTierShares())[priceTier] ?? 0;
}
