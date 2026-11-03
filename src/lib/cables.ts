import { bySize, type TreeNode } from "./category-tree";

/**
 * „კაბელები“ — ვირტუალური სეგმენტი ზოლში. კაბელები ხეში ოთხ ადგილასაა (ენერგო, LAN,
 * ოპტიკა, სახანძრო) და იქვე რჩება; აქ მხოლოდ ერთად ჩანს. საკუთარი კატეგორია არ აქვს —
 * /catalog/kabelebi ამ ჯგუფების პროდუქტებს აჩვენებს.
 */
export const CABLES_SLUG = "kabelebi";

/** რომელი კატეგორიები ჩანს — გზა ძირიდან; „*“ — ამ კატეგორიის ქვეჯგუფები ცალ-ცალკე */
const SOURCES: string[][] = [
  ["ენერგო უზრუნველყოფა", "კაბელი", "*"],
  ["LAN & WAN", "LAN კაბელები"],
  ["ოპტიკური ქსელი", "ოპტიკური კაბელები"],
  ["უსაფრთხოების სისტემები", "სახანძრო სიგნალიზაცია", "სახანძრო კაბელი"],
];

function find(roots: TreeNode[], path: string[]): TreeNode[] {
  let level = roots;
  let node: TreeNode | undefined;
  for (const name of path) {
    if (name === "*") return node?.children ?? [];
    node = level.find((n) => n.nameKa === name);
    if (!node) return [];
    level = node.children;
  }
  return node ? [node] : [];
}

/** ჯგუფები, რომლებშიც ხილული პროდუქტია — მენიუსა და კატალოგის ჩიპებისთვის */
export function cableGroups(roots: TreeNode[]): TreeNode[] {
  return SOURCES.flatMap((p) => find(roots, p))
    .filter((n) => n.visible > 0)
    .sort(bySize);
}

/** ზოლის სეგმენტი — ჩვეულებრივი კატეგორიის ფორმით, რომ Header-მა ერთნაირად დახატოს */
export function cablesSegment(roots: TreeNode[]): TreeNode | null {
  const children = cableGroups(roots);
  if (!children.length) return null;
  return {
    id: CABLES_SLUG,
    slug: CABLES_SLUG,
    nameKa: "კაბელები",
    nameEn: "Cables",
    nameRu: "Кабели",
    sortOrder: 0,
    parentId: null,
    visible: children.reduce((s, c) => s + c.visible, 0),
    children,
  };
}

/** ჯგუფების ყველა კატეგორია ქვეკატეგორიებითურთ — კატალოგის ფილტრისთვის */
export function cableCategoryIds(roots: TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (n: TreeNode) => {
    out.push(n.id);
    n.children.forEach(walk);
  };
  cableGroups(roots).forEach(walk);
  return out;
}
