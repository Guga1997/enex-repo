import { searchTerms } from "./search-terms";

/**
 * ძებნის შედეგების დალაგება შესაბამისობით.
 *
 * ადრე შედეგი ფასით ლაგდებოდა: „კამერა“-ზე პირველ გვერდზე კაბელის დამჭერები და ყუთები
 * იყო (იაფია და სახელში „კამერის“ უწერია), კამერა — არცერთი. ახლა ქულა ასე ითვლება:
 *
 *   კოდი/მოდელი ზუსტად           100     „IPC-B121H“ → სწორედ ის პროდუქტი
 *   კოდი/მოდელი ამით იწყება        70
 *   სახელში სიტყვა ამით იწყება     50     +10 თუ სახელის პირველ ორ სიტყვაშია („IP კამერა…“)
 *   ბრენდი                        45
 *   კოდი/მოდელი შეიცავს            40
 *   სახელი შეიცავს (სიტყვის შუაში) 30
 *   მხოლოდ სინონიმით/ფუძით         20     „კამერის სამაგრი“ ← „კამერა“
 *   + კატეგორია ემთხვევა           40     „IP კამერები“ კამერას წინ სწევს (მშობელი — 10)
 *   − აქსესუარების კატეგორია       25     სამაგრი/აქსესუარი მთავარ ნივთზე დაბლა
 *
 * რამდენიმე სიტყვაზე ქულები იკრიბება. ტოლ ქულაზე: ჯერ მარაგშია, მერე ადმინის რიგი, მერე ფასი.
 */

export type RankRow = {
  id: string;
  sku: string;
  model: string | null;
  nameKa: string;
  nameEn: string | null;
  nameRu: string | null;
  price: number;
  sortOrder: number;
  stockStatus: string;
  stockQty: number;
  reservedQty: number;
  brand: { name: string } | null;
  category: {
    nameKa: string;
    nameEn: string | null;
    nameRu: string | null;
    parent: { nameKa: string; nameEn: string | null; nameRu: string | null } | null;
  };
};

const lower = (s: string | null | undefined) => (s ?? "").toLowerCase();
/** სიტყვებად: ასოები და ციფრები; „Back-UPS“ → back, ups */
const tokens = (s: string | null | undefined) => lower(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** კოდების შესადარებლად: „IPC-B121H-C“ = „ipc b121h c“ */
const squash = (s: string | null | undefined) => lower(s).replace(/[^\p{L}\p{N}]+/gu, "");

const ACCESSORY = /აქსესუარ|სამაგრ|accessor|mount|аксессуар|креплен/i;

type Prepared = {
  codes: string[];
  names: { raw: string; tokens: string[] }[];
  brand: string;
  leaf: string[];
  parent: string[];
  accessory: boolean;
};

function prepare(r: RankRow): Prepared {
  const c = r.category;
  return {
    codes: [squash(r.sku), squash(r.model)].filter(Boolean),
    names: [r.nameKa, r.nameEn, r.nameRu].filter(Boolean).map((n) => ({ raw: lower(n), tokens: tokens(n) })),
    brand: lower(r.brand?.name),
    leaf: [c.nameKa, c.nameEn, c.nameRu].flatMap(tokens),
    parent: c.parent ? [c.parent.nameKa, c.parent.nameEn, c.parent.nameRu].flatMap(tokens) : [],
    accessory: ACCESSORY.test(`${c.nameKa} ${c.nameEn ?? ""}`),
  };
}

function termScore(p: Prepared, word: string, variants: string[]): number {
  const w = lower(word);
  const ws = squash(word);
  // ქართული ბრუნვა: „კამერები“ / „კამერის“ / „კამერა“ ერთი ფუძეა („კამერ“). ფუძე სინონიმების
  // ჯგუფიდან მოდის; თუ აკრეფილი სიტყვა მისით იწყება, სახელში სწორედ ფუძეს ვეძებთ.
  const all = variants.map(lower);
  const stem = all.filter((v) => v.length >= 3 && w.startsWith(v)).sort((a, b) => a.length - b.length)[0] ?? w;
  const others = all.filter((v) => v !== w && v !== stem);
  const starts = (tk: string, v: string) => tk.startsWith(v);

  let code = 0;
  if (ws.length >= 2) {
    for (const c of p.codes) {
      if (c === ws) code = Math.max(code, 100);
      else if (c.startsWith(ws)) code = Math.max(code, 70);
      else if (ws.length >= 3 && c.includes(ws)) code = Math.max(code, 40);
    }
  }

  let name = 0;
  for (const n of p.names) {
    const at = n.tokens.findIndex((tk) => starts(tk, stem));
    // ზუსტად აკრეფილი ფორმა („კამერა“) სახელობითია — ნივთი თვითონ; „კამერის…“ უფრო ხშირად აქსესუარია
    const exact = n.tokens.findIndex((tk) => tk === w);
    if (at >= 0) name = Math.max(name, 50 + ((exact >= 0 ? exact : at) < 2 ? 10 : 0) + (exact >= 0 ? 10 : 0));
    else if (n.raw.includes(w)) name = Math.max(name, 30);
    else {
      // მრავალსიტყვიანი სინონიმი („power supply“) მთლიან სახელში იძებნება
      const via = n.tokens.findIndex((tk) => others.some((v) => starts(tk, v)));
      if (via >= 0) name = Math.max(name, 20 + (via < 2 ? 5 : 0));
      else if (others.some((v) => v.includes(" ") && n.raw.includes(v))) name = Math.max(name, 20);
    }
  }

  const brand = p.brand && (p.brand === w ? 45 : p.brand.includes(w) ? 35 : 0);

  const inCat = (list: string[]) => list.some((tk) => starts(tk, stem) || others.some((v) => starts(tk, v)));
  const cat = inCat(p.leaf) ? 40 : inCat(p.parent) ? 10 : 0;

  const base = Math.max(code, name, brand || 0);
  if (!base && !cat) return 0;
  // ზუსტ კოდს აქსესუარობა არ აკლდება — მყიდველმა სწორედ ის მოითხოვა
  return Math.max(1, base + cat - (p.accessory && code < 70 ? 25 : 0));
}

export function relevance(row: RankRow, q: string): number {
  const p = prepare(row);
  let total = 0;
  for (const { word, variants } of searchTerms(q)) total += termScore(p, word, variants);
  return total;
}

const inStock = (r: RankRow) => (r.stockStatus === "IN_STOCK" && r.stockQty - r.reservedQty > 0 ? 0 : 1);

/** შედეგების id-ები შესაბამისობის რიგით */
export function rankIds(rows: RankRow[], q: string): string[] {
  return rows
    .map((r) => ({ r, score: relevance(r, q) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        inStock(a.r) - inStock(b.r) ||
        a.r.sortOrder - b.r.sortOrder ||
        a.r.price - b.r.price ||
        a.r.sku.localeCompare(b.r.sku)
    )
    .map((x) => x.r.id);
}

/** ორი სიტყვის განსხვავება ასოებში (ჩასმა, წაშლა, შეცვლა, მეზობლების გადასმა) — მცირე ზღვრამდე */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * შეცდომით აკრეფილი სიტყვა („hikvison“) → ყველაზე ახლო ცნობილი სიტყვა („hikvision“).
 * მხოლოდ 5+ ასოიან სიტყვაზე და მხოლოდ მაშინ, როცა ერთადერთი ახლო ვარიანტია — მოკლე
 * სიტყვებში ერთი ასო სხვა ნივთს ნიშნავს („ups“/„usb“).
 */
export function closestWord(word: string, known: Iterable<string>): string | null {
  const w = word.toLowerCase();
  if (w.length < 5) return null;
  const max = w.length >= 8 ? 2 : 1;
  let best: string | null = null;
  let bestD = max + 1;
  let ties = 0;
  for (const k of known) {
    if (k === w) return null;
    const d = editDistance(w, k, max);
    if (d < bestD) {
      best = k;
      bestD = d;
      ties = 1;
    } else if (d === bestD && k !== best) ties++;
  }
  return best && ties === 1 ? best : null;
}
