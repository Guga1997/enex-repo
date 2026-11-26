/**
 * ალტას B2B ვებ-სერვისი (SOAP, GetPriceList) — მოთხოვნის აწყობა და პასუხის წაკითხვა.
 * ქსელის გარეშე: ნამდვილი გამოძახება მხოლოდ პროდაქშენის სერვერიდან შეიძლება (სერვისი IP-ს იმახსოვრებს).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchAltaItems, parsePriceList, priceListRequest, qtyOf, credentials, ALTA_URL, type Transport } from "../src/lib/suppliers/alta";

const cfg = (over: object = {}) => ({
  slug: "alta", name: "Alta", baseUrl: null, authType: "NONE", secret: "ENEX_TEST:p&ss<1>", authHeader: null, fieldMap: null, ...over,
});

const envelope = (inner: string) =>
  `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns2:GetPriceListResponse xmlns:ns2="http://extra.alta.com.ge">${inner}</ns2:GetPriceListResponse></S:Body></S:Envelope>`;

// დოკუმენტაციის მაგალითი + ორი პოზიცია სხვა შემთხვევებისთვის
const RESPONSE = envelope(
  `<ns2:PriceList error_id="0" error_desc="" currency="GEL" includes_vat="1"><items>` +
    `<item item="57923" item_model="VFY:R1007SC050IN" item_full_name="SERVERS/ Fujitsu/\nRX100S7 Rack Server/ Quad Core Xeon E3-1220v2 4C/4T 3.10/3.50GHz 8GB DDR3 ECC 2x500GB SATA" qty_text="2" price_unit="2269.5718" brand="Fujitsu" category="Server"/>` +
    `<item item="60011" item_model="WD40EFAX" item_full_name="HDD/ WD Red 4TB 3.5&quot; SATA &amp; NAS" qty_text="&gt;=10" price_unit="310.5" price_unit2="349" brand="WD" category="HDD" weight_kg="0.65"/>` +
    `<item item="60012" item_model="X-1" item_full_name="Cable" qty_text="0" price_unit="0" brand="" category=""/>` +
    `</items></ns2:PriceList>`
);

test("მოთხოვნა: მომხმარებელი და პაროლი XML-ში უსაფრთხოდ; მთელი ნუსხა — ცარიელი item", () => {
  const { user, password } = credentials(cfg());
  assert.equal(user, "ENEX_TEST");
  assert.equal(password, "p&ss<1>");
  const body = priceListRequest(user, password);
  assert.ok(body.includes("<user>ENEX_TEST</user>"));
  assert.ok(body.includes("<password>p&amp;ss&lt;1&gt;</password>"));
  assert.ok(body.includes("<item></item>"));
  assert.ok(body.includes('xmlns:ext="http://extra.alta.com.ge"'));
  assert.throws(() => credentials(cfg({ secret: "paroli-orwertilis-gareshe" })), /მომხმარებელი:პაროლი/);
});

test("ნაშთი ტექსტიდან: „2“, „>=10“, ცარიელი", () => {
  assert.equal(qtyOf("2"), 2);
  assert.equal(qtyOf(">=10"), 10);
  assert.equal(qtyOf("0"), 0);
  assert.equal(qtyOf(""), 0);
  assert.equal(qtyOf(undefined), 0);
});

test("პასუხი: ატრიბუტები, ერთეულები (&quot; &amp;), ვალუტა და დღგ", () => {
  const list = parsePriceList(RESPONSE);
  assert.equal(list.currency, "GEL");
  assert.equal(list.includesVat, true);
  assert.equal(list.rows.length, 3, "<items> კონტეინერი პოზიციად არ ითვლება");
  assert.equal(list.rows[0].item, "57923");
  assert.equal(list.rows[0].item_full_name.includes("\n"), false, "გადატანა სახელში ჰარად იქცევა");
  assert.equal(list.rows[1].item_full_name, 'HDD/ WD Red 4TB 3.5" SATA & NAS');
  assert.equal(list.rows[1].qty_text, ">=10");
});

test("სერვისის შეცდომა გასაგები ტექსტით; ცარიელი ნუსხა სინქს აჩერებს", async () => {
  assert.throws(() => parsePriceList(envelope(`<ns2:PriceList error_id="3" error_desc="IP mismatch"/>`)), /IP mismatch/);
  assert.throws(() => parsePriceList(`<S:Envelope><S:Body><S:Fault><faultstring>Access denied</faultstring></S:Fault></S:Body></S:Envelope>`), /Access denied/);
  const empty: Transport = async () => ({ ok: true, status: 200, text: async () => envelope(`<ns2:PriceList error_id="0" error_desc=""><items/></ns2:PriceList>`) });
  await assert.rejects(() => fetchAltaItems(cfg(), empty), /ცარიელია/);
  const down: Transport = async () => ({ ok: false, status: 502, text: async () => "Bad Gateway" });
  await assert.rejects(() => fetchAltaItems(cfg(), down), /HTTP 502/);
});

test("პოზიციები: კოდი პრეფიქსით, ჩვენი ფასი, მათი საცალო მხოლოდ მითითებით, ნაშთი", async () => {
  const sent: { url: string; body: string; headers: Record<string, string> }[] = [];
  const http: Transport = async (url, init) => {
    sent.push({ url, body: init.body ?? "", headers: init.headers ?? {} });
    return { ok: true, status: 200, text: async () => RESPONSE };
  };
  const items = await fetchAltaItems(cfg(), http);
  assert.equal(sent.length, 1, "მთელი ნუსხა ერთი მოთხოვნით");
  assert.equal(sent[0].url, ALTA_URL);
  assert.match(sent[0].headers["Content-Type"], /text\/xml/);
  assert.equal(items.length, 3);

  const server = items[0];
  assert.equal(server.supplierSku, "ALTA-57923", "რიცხვითი კოდი სხვა მიმწოდებლისას რომ არ დაემთხვეს");
  assert.equal(server.model, "VFY:R1007SC050IN");
  assert.equal(server.brand, "Fujitsu");
  assert.equal(server.cost, 2269.57);
  assert.equal(server.listPrice, null);
  assert.equal(server.qty, 2);
  assert.deepEqual(server.categoryPath, ["Server"]);

  assert.equal(items[1].qty, 10, "„>=10“ — ათად ვთვლით");
  assert.equal(items[1].weightKg, 0.65);
  assert.equal(items[1].listPrice, null, "price_unit2 მხოლოდ მაშინ, როცა fieldMap-ში მითითებულია");
  assert.equal(items[2].cost, null, "ფასი 0 — ფასის გარეშე");
  assert.equal(items[2].status, "OUT_OF_STOCK");

  const withList = await fetchAltaItems(cfg({ fieldMap: JSON.stringify({ listField: "price_unit2", skuPrefix: "A" }) }), http);
  assert.equal(withList[1].supplierSku, "A60011");
  assert.equal(withList[1].listPrice, 349);
  assert.equal(withList[0].listPrice, null, "ველი ცარიელია — მათი საცალო არ ვიცით");
});

test("დღგ-ის გარეშე ფასი — +18%", async () => {
  const noVat: Transport = async () => ({
    ok: true, status: 200,
    text: async () => envelope(`<ns2:PriceList error_id="0" error_desc="" currency="GEL" includes_vat="0"><items><item item="1" item_model="M" item_full_name="N" qty_text="1" price_unit="100" brand="B" category="C"/></items></ns2:PriceList>`),
  });
  assert.equal((await fetchAltaItems(cfg(), noVat))[0].cost, 118);
});
