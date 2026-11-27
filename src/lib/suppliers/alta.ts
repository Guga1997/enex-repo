import { request } from "node:http";
import { request as requestTls } from "node:https";
import { getRate } from "../fx";
import { ALTA_CATEGORIES, altaBrand, altaName } from "./alta-catalog";
import type { SupplierAdapter, SupplierConfig, SupplierItem } from "./types";

/**
 * ალტა — საბითუმო (B2B) ვებ-სერვისი, SOAP. მხოლოდ კითხვა: GetPriceList.
 *
 *   მისამართი: http://extra.alta.com.ge/b2b/b2bEWS   (WSDL: …?WSDL; HTTPS-ს არ ემსახურება)
 *   secret:   „მომხმარებელი:პაროლი“ (ერთ ველში, ორწერტილით) — იგივე, რაც b2b.alta.ge-ზე
 *
 * სერვისი **პირველ მიმართვაზე IP მისამართს იმახსოვრებს** და შემდეგ მხოლოდ იქიდან პასუხობს.
 * ამიტომ პირველი გამოძახება პროდაქშენის სერვერიდან უნდა წავიდეს (და არა ვინმეს კომპიუტერიდან),
 * თანაც მხოლოდ IPv4-ით — სერვერს IPv6-იც აქვს და მისამართი არ უნდა „გადახტეს“.
 *
 * პასუხი: <item item="57923" item_model="…" item_full_name="…" qty_text="2" price_unit="2269.57"
 *               price_unit2="…" brand="Fujitsu" category="Server" weight_kg="…"/>
 *   qty_text  — ნაშთი ტექსტად; 10-ზე მეტი → „>=10“ (ზუსტი ციფრი არ ვიცით, 10-ად ვთვლით)
 *   3 დღეზე მეტხანს უმარაგო პოზიცია სიაში საერთოდ არ მოდის — სინქი მას „გამქრალად“ ნიშნავს
 *   price_unit — ჩვენი (საბითუმო) ფასი; PriceList-ს აწერია currency და includes_vat
 *
 * fieldMap (არასავალდებულო): { "skuPrefix": "ALTA-", "listField": "price_unit2" }
 *   skuPrefix — ალტას კოდი ხუთნიშნა რიცხვია და სხვა მიმწოდებლის კოდს დაემთხვეოდა; პრეფიქსით
 *               პროდუქტი არასდროს ერევა სხვისას. listField — რომელი ველია მათი საცალო (თუ არის).
 */

type Init = { method?: string; headers?: Record<string, string>; body?: string };
type Res = { ok: boolean; status: number; text(): Promise<string> };
export type Transport = (url: string, init: Init) => Promise<Res>;

export const ALTA_URL = "http://extra.alta.com.ge/b2b/b2bEWS";
const TIMEOUT_MS = 180_000; // მთელი ნუსხა ერთ პასუხად მოდის

/** HTTP(S) მხოლოდ IPv4-ით — სერვისი IP-ს იმახსოვრებს */
const ipv4: Transport = (url, init) =>
  new Promise((resolve, reject) => {
    const send = url.startsWith("https:") ? requestTls : request;
    const req = send(url, { method: init.method ?? "GET", headers: init.headers, family: 4, timeout: TIMEOUT_MS }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const status = res.statusCode ?? 0;
        resolve({ ok: status >= 200 && status < 300, status, text: async () => Buffer.concat(chunks).toString("utf8") });
      });
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("ალტა: პასუხი არ მოვიდა 3 წუთში")));
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unxml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** ტეგის ატრიბუტები: name="value" → { name: value } */
function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = unxml(m[2]).replace(/\s+/g, " ").trim();
  return out;
}

export function credentials(cfg: SupplierConfig): { user: string; password: string } {
  const s = cfg.secret ?? "";
  const i = s.indexOf(":");
  if (i <= 0 || i === s.length - 1) throw new Error("გასაღები ფორმატში „მომხმარებელი:პაროლი“ უნდა იყოს");
  return { user: s.slice(0, i), password: s.slice(i + 1) };
}

export function priceListRequest(user: string, password: string, item = ""): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ext="http://extra.alta.com.ge">` +
    `<soapenv:Header/><soapenv:Body><ext:GetPriceList>` +
    `<user>${xml(user)}</user><password>${xml(password)}</password><item>${xml(item)}</item>` +
    `</ext:GetPriceList></soapenv:Body></soapenv:Envelope>`
  );
}

/** „2“ → 2, „>=10“ → 10, ცარიელი ან გაუგებარი → 0 */
export function qtyOf(text: string | undefined): number {
  const n = Number((text ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

const price = (s: string | undefined): number | null => {
  const n = Number((s ?? "").replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

export type AltaList = { currency: string; includesVat: boolean | null; rows: Record<string, string>[] };

/** SOAP პასუხი → სტრიქონები. სერვისის შეცდომა (error_id ≠ 0) — გამონაკლისი მათი ტექსტით. */
export function parsePriceList(body: string): AltaList {
  const fault = body.match(/<(?:\w+:)?faultstring[^>]*>([\s\S]*?)<\/(?:\w+:)?faultstring>/i);
  if (fault) throw new Error(`ალტა: ${unxml(fault[1]).trim().slice(0, 300)}`);
  const head = body.match(/<(?:\w+:)?PriceList\b[^>]*>/);
  if (!head) throw new Error("ალტა: პასუხში ფასთა ნუსხა არ არის");
  const h = attrs(head[0]);
  if (h.error_id && h.error_id !== "0") throw new Error(`ალტა: ${h.error_desc || "შეცდომა " + h.error_id}`);
  const vat = (h.includes_vat ?? "").toLowerCase();
  const rows: Record<string, string>[] = [];
  // <items> კონტეინერი ატრიბუტების გარეშეა; პოზიცია — <item item="…" …/>
  for (const m of body.matchAll(/<item\s[^>]*?\/?>/g)) {
    const a = attrs(m[0]);
    if (a.item) rows.push(a);
  }
  return {
    currency: (h.currency || "GEL").toUpperCase(),
    includesVat: vat ? !/^(0|n|no|false|არა)$/.test(vat) : null,
    rows,
  };
}

type FieldMap = { skuPrefix?: string; listField?: string; vatRate?: number };

export async function fetchAltaItems(cfg: SupplierConfig, http: Transport = ipv4): Promise<SupplierItem[]> {
  const { user, password } = credentials(cfg);
  const map = (cfg.fieldMap?.trim() ? JSON.parse(cfg.fieldMap) : {}) as FieldMap;
  const prefix = map.skuPrefix ?? "ALTA-";

  const res = await http(cfg.baseUrl?.trim() || ALTA_URL, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""' },
    body: priceListRequest(user, password),
  });
  const body = await res.text();
  // SOAP შეცდომა 500-ით მოდის, ტექსტი კი ტანშია — ჯერ ტანს ვკითხულობთ
  if (!res.ok && !/faultstring|PriceList/i.test(body)) throw new Error(`ალტა: HTTP ${res.status}`);
  const list = parsePriceList(body);
  if (!list.rows.length) throw new Error("ალტა: ნუსხა ცარიელია — სინქი ჩერდება, ნაშთები არ ნულდება");

  // ფასი ლარში, დღგ-ით: სხვა ვალუტა — ეროვნული ბანკის კურსით; დღგ-ის გარეშე — +18%
  const fx = list.currency === "GEL" ? 1 : (await getRate(list.currency)).rate;
  const vat = list.includesVat === false ? 1 + (map.vatRate ?? 18) / 100 : 1;
  const gel = (n: number | null) => (n === null ? null : Math.round(n * fx * vat * 100) / 100);

  const items: SupplierItem[] = [];
  const seen = new Set<string>();
  for (const r of list.rows) {
    const raw = r.item_full_name || r.item_model;
    if (!raw || seen.has(r.item)) continue;
    // B2B-ის სახელი მათი შიდა ხის გზაა, კატეგორია — ინგლისური იარლიყი: ორივე ჩვენს სახეზე გადაგვყავს
    const name = altaName({ name: raw, brand: r.brand, model: r.item_model, category: r.category }).ka;
    seen.add(r.item);
    const cost = gel(price(r.price_unit));
    const listPrice = map.listField ? gel(price(r[map.listField])) : null;
    const qty = qtyOf(r.qty_text);
    const weight = price(r.weight_kg);
    items.push({
      supplierSku: prefix + r.item,
      name,
      model: r.item_model || null,
      brand: altaBrand(r.brand),
      categoryPath: ALTA_CATEGORIES[r.category]?.path ?? (r.category ? [r.category] : []),
      cost,
      // მათი საცალო მხოლოდ მაშინ, როცა ჩვენს ფასზე მაღალია — სხვაგვარად ერთფასიანი პოზიციაა
      listPrice: listPrice !== null && cost !== null && listPrice > cost ? listPrice : null,
      qty,
      status: qty > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
      weightKg: weight,
    });
  }
  return items;
}

export const alta: SupplierAdapter = { fetchItems: (cfg) => fetchAltaItems(cfg) };
