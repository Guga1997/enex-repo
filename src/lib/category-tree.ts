import { db } from "./db";

/**
 * მენიუს ხე: ჩართული კატეგორიები და თითოეულში ხილული პროდუქტების რაოდენობა
 * (ქვეკატეგორიების ჩათვლით). „ხილული“ იგივეა, რაც კატალოგში — ჩართული და ფასიანი.
 *
 * რიგი: ჯერ სავსე, მერე ცარიელი; ორივე ჯგუფში — ადმინის sortOrder. ასე
 * ცარიელი ქვეჯგუფი მენიუს თავში აღარ დგას და მყიდველს „არაფერი არ არის“ არ ხვდება.
 *
 * ერთი მოთხოვნა კატეგორიებზე და ერთი დაჯგუფება პროდუქტებზე; 60 წამი ინახება
 * (ყოველ გვერდზე Header-ს სჭირდება). ადმინში კატეგორიის შეცვლა ქეშს ასუფთავებს.
 */

export type TreeNode = {
  id: string;
  slug: string;
  nameKa: string;
  nameEn: string | null;
  nameRu: string | null;
  sortOrder: number;
  parentId: string | null;
  /** ხილული პროდუქტი ამ კატეგორიაში და მის ყველა ქვეკატეგორიაში */
  visible: number;
  children: TreeNode[];
};

type Built = { roots: TreeNode[]; byId: Map<string, TreeNode> };

const TTL_MS = 60_000;
let cache: { at: number; value: Built } | null = null;

export function invalidateCategoryTree() {
  cache = null;
}

/** სავსე წინ, ცარიელი ბოლოს; შიგნით — sortOrder, მერე სახელი */
export function byFullness(a: { visible: number; sortOrder: number; nameKa: string }, b: typeof a): number {
  const full = Number(b.visible > 0) - Number(a.visible > 0);
  return full || a.sortOrder - b.sortOrder || a.nameKa.localeCompare(b.nameKa, "ka");
}

export function buildTree(
  cats: Omit<TreeNode, "visible" | "children">[],
  counts: Map<string, number>
): Built {
  const byId = new Map<string, TreeNode>(cats.map((c) => [c.id, { ...c, visible: 0, children: [] }]));
  const roots: TreeNode[] = [];
  for (const n of byId.values()) {
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    if (parent) parent.children.push(n);
    else if (!n.parentId) roots.push(n); // გამორთული მშობლის შვილი მენიუში არ ჩანს
  }
  const sum = (n: TreeNode): number => {
    n.visible = (counts.get(n.id) ?? 0) + n.children.reduce((s, c) => s + sum(c), 0);
    n.children.sort(byFullness);
    return n.visible;
  };
  roots.forEach(sum);
  roots.sort(byFullness);
  return { roots, byId };
}

async function load(): Promise<Built> {
  const [cats, groups] = await Promise.all([
    db.category.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, nameKa: true, nameEn: true, nameRu: true, sortOrder: true, parentId: true },
    }),
    db.product.groupBy({
      by: ["categoryId"],
      where: { isActive: true, price: { gt: 0 } },
      _count: { _all: true },
    }),
  ]);
  return buildTree(cats, new Map(groups.map((g) => [g.categoryId, g._count._all])));
}

export async function getCategoryTree(): Promise<Built> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = await load();
  cache = { at: Date.now(), value };
  return value;
}
