import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

/**
 * ვალუტის კურსი ეროვნული ბანკიდან (nbg.gov.ge) — ევროში/დოლარში მოცემული ფასთა ნუსხები
 * ლარში ამით გადაითვლება. ბანკი კურსს დღეში ერთხელ აქვეყნებს (~17:00, მომდევნო დღისთვის);
 * ჩვენ დღეში ერთხელ ვკითხულობთ და data/fx.json-ში ვინახავთ, რომ სინქმა ყოველ 10 წუთში
 * ბანკს არ აწუხოს და ბანკის გათიშვისას ბოლო ცნობილი კურსი გვქონდეს.
 */

const NBG_URL = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json";
const CACHE = path.join(process.cwd(), "data", "fx.json");
const MAX_AGE_MS = 12 * 60 * 60_000;

type Cache = { fetchedAt: string; validFrom: string; rates: Record<string, number> };

type NbgDay = {
  date: string;
  currencies: { code: string; quantity: number; rate: number; validFromDate: string }[];
};

async function readCache(): Promise<Cache | null> {
  try {
    return JSON.parse(await readFile(CACHE, "utf8")) as Cache;
  } catch {
    return null;
  }
}

async function fetchFromNbg(): Promise<Cache> {
  const res = await fetch(NBG_URL, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`NBG HTTP ${res.status}`);
  const [day] = (await res.json()) as NbgDay[];
  if (!day?.currencies?.length) throw new Error("NBG: კურსები ვერ წავიკითხე");
  const rates: Record<string, number> = { GEL: 1 };
  // ზოგი ვალუტა 100 ან 1000 ერთეულზეა კოტირებული — ერთ ერთეულზე დავიყვანოთ
  for (const c of day.currencies) rates[c.code] = c.rate / (c.quantity || 1);
  const cache: Cache = { fetchedAt: new Date().toISOString(), validFrom: day.date, rates };
  await mkdir(path.dirname(CACHE), { recursive: true });
  await writeFile(CACHE, JSON.stringify(cache, null, 2));
  return cache;
}

/** კურსი ლარში ერთ ერთეულზე: getRate("EUR") → 2.9941 */
export async function getRate(code: string): Promise<{ rate: number; validFrom: string; fetchedAt: string }> {
  const upper = code.toUpperCase();
  if (upper === "GEL") return { rate: 1, validFrom: "", fetchedAt: "" };

  let cache = await readCache();
  const stale = !cache || Date.now() - Date.parse(cache.fetchedAt) > MAX_AGE_MS;
  if (stale) {
    try {
      cache = await fetchFromNbg();
    } catch (e) {
      if (!cache) throw e; // პირველი ჩატვირთვაც ჩავარდა — კურსის გარეშე ფასს ვერ დავდებთ
      console.warn("NBG ვერ ვნახე, ძველი კურსით ვაგრძელებ:", e instanceof Error ? e.message : e);
    }
  }
  const rate = cache!.rates[upper];
  if (!rate) throw new Error(`ვალუტა ${upper} NBG-ის სიაში არ არის`);
  return { rate, validFrom: cache!.validFrom, fetchedAt: cache!.fetchedAt };
}
