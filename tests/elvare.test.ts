/**
 * Elvare-ს ადაპტერი — დოკუმენტაციის ნიმუშზე (Elvare-Partner-API-Dealer.docx).
 * ქსელს არ ვეხებით: გადამცემი ჩანაცვლებულია.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryPaths, makeElvare, toItem, type Transport } from "../src/lib/suppliers/elvare";
import type { SupplierConfig } from "../src/lib/suppliers/types";

const cats = [
  { id: "c1", name: "კაბელები", parent_id: "", sort_order: 1 },
  { id: "c2", name: "ძალოვანი კაბელები", parent_id: "c1", sort_order: 1 },
];
const product = {
  id: "3f1c",
  sku: "G_-00017595",
  name: "ავტომატური ამომრთველი 6kA C 1P 10A Tengen TGB1N-63",
  category_id: "c2",
  brand_id: "b1",
  price: 6.5,
  dealer_price: 5.85,
  currency: "GEL",
  unit: "ც",
  in_stock: true,
  quantity: 120,
  images: ["https://elvare.ge/images/3f1c/0"],
};

test("კატეგორიის გზა ძირიდან", () => {
  assert.deepEqual(categoryPaths(cats).get("c2"), ["კაბელები", "ძალოვანი კაბელები"]);
});

test("პროდუქტი: dealer_price თვითღირებულებაა, price — საცალო", () => {
  const item = toItem(product, categoryPaths(cats), new Map([["b1", "Tengen"]]))!;
  assert.equal(item.supplierSku, "G_-00017595");
  assert.equal(item.cost, 5.85);
  assert.equal(item.listPrice, 6.5);
  assert.equal(item.qty, 120);
  assert.equal(item.brand, "Tengen");
  assert.equal(item.model, "TGB1N-63");
  assert.deepEqual(item.categoryPath, ["კაბელები", "ძალოვანი კაბელები"]);
  assert.deepEqual(item.images, ["https://elvare.ge/images/3f1c/0"]);
});

test("ფასის გარეშე ან სხვა ვალუტაში — არ შემოდის", () => {
  const paths = categoryPaths(cats);
  assert.equal(toItem({ ...product, price: 0, dealer_price: 0 }, paths, new Map()), null);
  assert.equal(toItem({ ...product, currency: "USD" }, paths, new Map()), null);
});

test("fetchItems: ტოკენი, კატეგორიები, ბრენდები, ყველა გვერდი", async () => {
  const calls: string[] = [];
  const send: Transport = async (url, init) => {
    calls.push(`${init.method ?? "GET"} ${url}`);
    const json = (b: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(b) });
    if (url.endsWith("/token")) {
      assert.deepEqual(JSON.parse(String(init.body)), { login: "enex", password: "p:ss" });
      return json({ access_token: "T", token_type: "Bearer", expires_in: 3600 });
    }
    assert.equal(init.headers?.Authorization, "Bearer T");
    if (url.endsWith("/categories")) return json({ items: cats });
    if (url.endsWith("/brands")) return json({ items: [{ id: "b1", name: "Tengen" }] });
    const page = Number(new URL(url).searchParams.get("page"));
    return json({ items: [{ ...product, sku: `S${page}` }], page, total_pages: 2 });
  };
  const cfg: SupplierConfig = {
    slug: "elvare", name: "Elvare", baseUrl: "https://webapi.elvare.ge/ext/v1",
    authType: "NONE", secret: "enex:p:ss", authHeader: null, fieldMap: null,
  };
  const items = await makeElvare(send).fetchItems(cfg);
  assert.deepEqual(items.map((i) => i.supplierSku), ["S1", "S2"]);
  assert.equal(calls.filter((c) => c.includes("/products")).length, 2);
});

test("IP არ არის რეგისტრირებული — გასაგები შეცდომა", async () => {
  const send: Transport = async () => ({ ok: false, status: 403, text: async () => JSON.stringify({ error: "ip_not_allowed" }) });
  await assert.rejects(
    makeElvare(send).fetchItems({ slug: "e", name: "E", baseUrl: null, authType: "NONE", secret: "a:b", authHeader: null, fieldMap: null }),
    /ip_not_allowed — სერვერის IP/
  );
});
