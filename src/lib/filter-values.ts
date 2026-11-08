/**
 * ფილტრის რამდენიმე მნიშვნელობა მისამართში: "a|b". მძიმე გამყოფად აღარ გამოდგება —
 * მნიშვნელობაშივე გვხვდება ("2,5 მმ²", "H.265, H.264") და ასეთი ფილტრი 0 შედეგს აბრუნებდა.
 * ძველი ბმული ("a,b") ისევ მუშაობს: მთლიანი სტრიქონიც ითვლება და მძიმით დაყოფილიც.
 */
export const FILTER_SEP = "|";

export function splitFilter(v: string | null | undefined): string[] {
  if (!v) return [];
  if (v.includes(FILTER_SEP)) return v.split(FILTER_SEP).filter(Boolean);
  if (!v.includes(",")) return [v];
  return [...new Set([v, ...v.split(",").map((s) => s.trim())])].filter(Boolean);
}

export const joinFilter = (values: string[]) => values.join(FILTER_SEP);
