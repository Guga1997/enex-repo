import { test } from "node:test";
import assert from "node:assert/strict";
import { ALTA_CATEGORIES, ALTA_CATEGORY_NAMES, altaBrand, altaName } from "../src/lib/suppliers/alta-catalog";

test("ალტა: ბრენდის გასუფთავება", () => {
  assert.equal(altaBrand("(TP)_Apple"), "Apple");
  assert.equal(altaBrand("Delonghi"), "DeLonghi");
  assert.equal(altaBrand(""), null);
  assert.equal(altaBrand(null), null);
});

test("ალტა: სახელი — გზის ბოლო სეგმენტი, ბრენდით", () => {
  const n = (name: string, brand: string, category: string, model = "") => altaName({ name, brand, category, model }).ka;
  assert.equal(n("Mobile and Smartphones/ Apple/ Apple iPhone 16 128GB White E-sim/TP", "(TP)_Apple", "Smartphone"), "Apple iPhone 16 128GB White E-sim");
  assert.equal(
    n('Notebook/ Lenovo/ Ideapad/ Ideapad Slim 3 15.3" Core 5 320 16GB 512GB SSD Luna Grey', "Lenovo", "Notebook"),
    'Lenovo Ideapad Slim 3 15.3" Core 5 320 16GB 512GB SSD Luna Grey',
  );
  // ბრენდი ბოლოში დიდი ასოებით — წინ გადმოდის
  assert.equal(n("Heater/ SOH 3509BK Oil Heater SENCOR", "Sencor", "Heater"), "Sencor SOH 3509BK Oil Heater");
  // 12GB/256GB სახელის ნაწილია და არ იჭრება
  assert.equal(n("Mobile and Smartphones/ Honor/ Honor 600 Pro 12GB/256GB Dual Golden", "Honor", "Smartphone"), "Honor 600 Pro 12GB/256GB Dual Golden");
});

test("ალტა: სახელი — მხოლოდ მოდელს ტიპი ერთვის, „ A / B “ მახასიათებლები რჩება", () => {
  const n = (name: string, brand: string, category: string) => altaName({ name, brand, category });
  assert.deepEqual(n("Refrigerator/ GR-B22FFLZB.APYQMER", "LG", "Refrigerator"), {
    ka: "LG GR-B22FFLZB.APYQMER — მაცივარი",
    en: "LG GR-B22FFLZB.APYQMER — Refrigerator",
  });
  assert.equal(
    n("Hob/ AEG/ AEG HDB64623NB / 2Induction+2Gas / 60cm / Black Glass", "AEG", "Built-in Hob").ka,
    "AEG HDB64623NB / 2Induction+2Gas / 60cm / Black Glass — ჩასაშენებელი ქურა",
  );
  assert.equal(n("Refrigerator/ (Promo) RB53DG703EB1WR Bottom-Freezer 554LT", "Samsung", "Refrigerator").ka, "Samsung RB53DG703EB1WR Bottom-Freezer 554LT — მაცივარი");
  // ტელევიზორის ზომა წინა სეგმენტიდან
  assert.equal(n('TV/ OLED/ Samsung/ TV 65"(165cm)/ Samsung OLED QE65S85HAEXPY 120Hz', "Samsung", "TV").ka, 'Samsung OLED QE65S85HAEXPY 120Hz — 65" ტელევიზორი');
  // ტიპი უკვე წერია — აღარ ემატება
  assert.equal(n("Kettle/ SWK 2727MB Electric kettle", "Sencor", "Kettle").ka, "Sencor SWK 2727MB Electric kettle");
});

test("ალტა: კატეგორიების რუკა — ყველა ახალ სახელს აქვს თარგმანი, სეგმენტები მფლობელის არჩეულია", () => {
  assert.deepEqual(ALTA_CATEGORIES["Smartphone"].path, ["მობილური ტელეფონები და აქსესუარები", "სმარტფონები"]);
  assert.deepEqual(ALTA_CATEGORIES["TV"].path, ["აუდიო-ვიდეო", "ტელევიზორები"]);
  assert.equal(ALTA_CATEGORIES["Wall Bracket"], undefined, "ტელევიზორებიდან მხოლოდ ტელევიზორი");
  assert.equal(ALTA_CATEGORIES["Vacuum Cleaner"], undefined);
  for (const [k, v] of Object.entries(ALTA_CATEGORY_NAMES)) assert.ok(v[0] && v[1], k);
  const segments = new Set(Object.values(ALTA_CATEGORIES).map((c) => c.segment));
  assert.deepEqual([...segments].sort(), ["computers", "gaming", "large", "mobile", "small", "tv"]);
});
