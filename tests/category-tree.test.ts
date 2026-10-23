/**
 * მენიუს ხე: ხილული პროდუქტები ქვეკატეგორიების ჩათვლით და რიგი —
 * სავსე წინ, ცარიელი ბოლოს, ორივე ჯგუფში ადმინის sortOrder.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTree } from "../src/lib/category-tree";

const cat = (id: string, parentId: string | null, sortOrder: number) => ({
  id, slug: id, nameKa: id, nameEn: null, nameRu: null, sortOrder, parentId,
});

test("რაოდენობა ქვეკატეგორიებიდან ზემოთ ჯამდება", () => {
  const { byId } = buildTree(
    [cat("security", null, 0), cat("alarm", "security", 0), cat("detectors", "alarm", 0), cat("sirens", "alarm", 1)],
    new Map([["detectors", 5], ["sirens", 2], ["alarm", 1]])
  );
  assert.equal(byId.get("alarm")!.visible, 8);
  assert.equal(byId.get("security")!.visible, 8);
});

test("ცარიელი ბოლოს, დანარჩენი sortOrder-ით", () => {
  const { byId } = buildTree(
    [
      cat("root", null, 0),
      cat("empty-first", "root", 0), // sortOrder-ით პირველია, მაგრამ ცარიელია
      cat("b", "root", 2),
      cat("a", "root", 1),
      cat("empty-last", "root", 3),
    ],
    new Map([["a", 3], ["b", 1]])
  );
  assert.deepEqual(byId.get("root")!.children.map((c) => c.id), ["a", "b", "empty-first", "empty-last"]);
});

test("გამორთული მშობლის შვილი მენიუში არ ჩნდება", () => {
  // გამორთული კატეგორია ხეში არ მოდის (where: isActive) — მისი შვილი ძირად არ უნდა იქცეს
  const { roots } = buildTree([cat("root", null, 0), cat("orphan", "missing-parent", 0)], new Map());
  assert.deepEqual(roots.map((r) => r.id), ["root"]);
});
