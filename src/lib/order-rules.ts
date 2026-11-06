/**
 * კაბელების შეკვეთის წესი.
 * ელექტრო კაბელი მეტრზეა დაფასებული: 10 მმ²-მდე მინიმუმ 100 მ, 10 მმ²-დან ზემოთ მინიმუმ 10 მ.
 * ქსელის კაბელი მხოლოდ შეკვრით (305 მ): მეტრზე დაფასებულს ბიჯი 305-ია, შეკვრაზე
 * დაფასებული (Intellcom, 100₾-ზე ძვირი) უკვე ერთი ცალია და წესი არ სჭირდება.
 * სახელს „305 მეტრი“-სთვის ვერ ვენდობით — ზოგს აწერია, ფასი კი მეტრისაა.
 */
export type OrderRule = { minQty: number; qtyStep: number; unit: string };

export const THIN_CABLE_MIN_METERS = 100;
export const THICK_CABLE_MIN_METERS = 10;
export const THICK_FROM_MM2 = 10;
export const NETWORK_REEL_METERS = 305;
/** ამაზე იაფი ქსელის კაბელი მეტრის ფასია, ძვირი — შეკვრის */
const PER_METER_BELOW = 20;

const ELECTRIC = new Set(["სამონტაჟო კაბელი", "მაღალი ძაბვის კაბელი"]);

/**
 * ძარღვის კვეთი მმ²-ში სახელიდან: „NYM 2X1.5“ → 1.5, „АВВГ 3X35+1X16“ → 35 (მთავარი ძარღვი),
 * „NA2XSEY 6/10 kV 3X70/16“ → 70, „ACSR 35/6.2“ → 35. კირილიცის „х“-იც გვხვდება.
 */
export function cableSectionMm2(name: string): number | null {
  const s = name.replace(/[хХxX×]/g, "X");
  const m = s.match(/\d+\s*X\s*(\d+(?:[.,]\d+)?)/) ?? s.match(/(?:ACSR|АСSR)\s+(\d+(?:[.,]\d+)?)\//);
  return m ? Number(m[1].replace(",", ".")) : null;
}

/** chain — კატეგორიების გზა ძირიდან. კვეთი თუ ვერ ამოიკითხა, მინიმუმი დიდია — ხელით შეიცვლება */
export function cableOrderRule(chain: string[], price: number, name: string): OrderRule | null {
  if (chain.includes("LAN კაბელები")) {
    return price < PER_METER_BELOW
      ? { minQty: NETWORK_REEL_METERS, qtyStep: NETWORK_REEL_METERS, unit: "მ" }
      : null;
  }
  if (chain[0] === "ენერგო უზრუნველყოფა" && chain[1] === "კაბელი" && ELECTRIC.has(chain[2])) {
    const mm2 = cableSectionMm2(name);
    const minQty = mm2 !== null && mm2 >= THICK_FROM_MM2 ? THICK_CABLE_MIN_METERS : THIN_CABLE_MIN_METERS;
    return { minQty, qtyStep: 1, unit: "მ" };
  }
  return null;
}
