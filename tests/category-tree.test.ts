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

test("ქვეჯგუფიანი წინ, ცალსტრიქონიანი ბოლოს — ბადეში ხვრელი არ რჩება", () => {
  const { byId } = buildTree(
    [
      cat("lan", null, 0),
      cat("controllers", "lan", 0), // პროდუქტი აქვს, ქვეჯგუფი — არა
      cat("wifi", "lan", 1),
      cat("ap", "wifi", 0),
      cat("empty-nested", "lan", 2),
      cat("empty-leaf", "empty-nested", 0),
    ],
    new Map([["controllers", 2], ["ap", 5]])
  );
  assert.deepEqual(byId.get("lan")!.children.map((c) => c.id), ["wifi", "empty-nested", "controllers"]);
});

test("გამორთული მშობლის შვილი მენიუში არ ჩნდება", () => {
  // გამორთული კატეგორია ხეში არ მოდის (where: isActive) — მისი შვილი ძირად არ უნდა იქცეს
  const { roots } = buildTree([cat("root", null, 0), cat("orphan", "missing-parent", 0)], new Map());
  assert.deepEqual(roots.map((r) => r.id), ["root"]);
});

test("ქვეჯგუფები: მეტი ქვეპუნქტი წინ, ტოლებში — მეტი პროდუქტი", () => {
  const { byId } = buildTree(
    [
      cat("root", null, 0),
      cat("one-small", "root", 0),
      cat("x1", "one-small", 0),
      cat("one-big", "root", 1),
      cat("x2", "one-big", 0),
      cat("two", "root", 2),
      cat("x3", "two", 0),
      cat("x4", "two", 1),
      cat("leaf-small", "root", 3),
      cat("leaf-big", "root", 4),
    ],
    new Map([["x1", 1], ["x2", 9], ["x3", 1], ["leaf-small", 2], ["leaf-big", 5]])
  );
  assert.deepEqual(byId.get("root")!.children.map((c) => c.id), ["two", "one-big", "one-small", "leaf-big", "leaf-small"]);
});
