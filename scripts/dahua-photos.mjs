#!/usr/bin/env node
/**
 * Dahua-ს პროდუქტების ფოტოები მწარმოებლის ოფიციალური საიტიდან (dahuasecurity.com) — მოდელით.
 *
 *   node scripts/dahua-photos.mjs <channel.csv> [<wisualarm.csv> …]          — ძებნა და ჩაწერა
 *   node scripts/dahua-photos.mjs <…csv> --only "IPC-HFW1439TL1-A-IL,ASC3202B"  — რამდენიმე მოდელი
 *
 * შედეგი: data/dahua-photos.json — { "<მოდელი>": { page, matched, exact, images: [url, …] } }.
 * ფაილს GDRIVE_CSV ადაპტერი კითხულობს (fieldMap.photos) და ახალ პროდუქტს ფოტოებს აბამს;
 * სინქი მათ ჩვენს დისკზე ჩამოტვირთავს. უკვე ნაპოვნი მოდელი თავიდან არ იძებნება (--force).
 *
 * ფოტო მწარმოებლის საცავში 4000 px-ია; ბმულს ზომის პარამეტრი ემატება (1000 px, webp).
 */
import fs from "fs";
import path from "path";

const OUT = path.join(process.cwd(), "data", "dahua-photos.json");
const SITE = "https://www.dahuasecurity.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const RESIZE = "?x-oss-process=image/resize,w_1000/format,webp";
const args = process.argv.slice(2);
const files = args.filter((a) => a.toLowerCase().endsWith(".csv"));
const FORCE = args.includes("--force");
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",").map((s) => s.trim().toUpperCase())) : null;
if (!files.length) {
  console.log("გამოყენება: node scripts/dahua-photos.mjs <ფაილი.csv> [...] [--only A,B] [--force]");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(40_000) });
      if (res.status === 404) return "";
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(1500 * i);
    }
  }
}

/* ── მოდელები CSV-დან: მეორე სვეტის პირველი სიტყვა (ობიექტივის გარეშე — ფოტო ერთია) ── */
function modelsFrom(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const out = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    const m = line.match(/^"?\d+"?,"?([^",\s]+)/);
    if (m) out.push(m[1].trim());
  }
  return out;
}

const norm = (s) => s.toUpperCase().replace(/&AMP;/g, "&").replace(/\s+/g, "");
/** PAL-ის „P“ მოდელის მეორე ნაწილის ბოლოს (HFW1200RP → HFW1200R) — საიტზე მის გარეშე წერია */
const withoutPal = (m) => {
  const p = m.split("-");
  if (p.length > 1 && /[A-Z0-9]P$/i.test(p[1]) && p[1].length > 3) p[1] = p[1].slice(0, -1);
  return p.join("-");
};

/** ძებნის შედეგები: [{ href, model }] */
function results(html) {
  const start = html.indexOf('id="searchProducts"');
  if (start < 0) return [];
  const block = html.slice(start, html.indexOf("</ul>", start));
  const out = [];
  for (const li of block.split("<li>").slice(1)) {
    const href = li.match(/<a href="([^"]+)"/)?.[1];
    const alt = li.match(/<img[^>]*alt="([^"]*)"/s)?.[1];
    const text = li.match(/search-products-text">([\s\S]*?)<\/p>/)?.[1]?.replace(/<[^>]+>/g, "").trim();
    const img = li.match(/<img[^>]*src="(https:\/\/material[^"]+)"/s)?.[1];
    if (href) out.push({ href: href.replace(/&amp;/g, "&"), model: (text || alt || "").trim(), img });
  }
  return out;
}

/** საუკეთესო დამთხვევა: ზუსტი → ჩვენი მოდელი + სუფიქსი (=S2, -S2…) → საერთო თავსართი ≥ 85% */
function pick(list, wanted) {
  const w = norm(wanted);
  const live = (r) => (r.href.includes("discontinued") ? 0 : 1);
  const exact = list.filter((r) => norm(r.model) === w).sort((a, b) => live(b) - live(a))[0];
  if (exact) return { ...exact, exact: true };
  const suffix = list
    .filter((r) => norm(r.model).startsWith(w) && /^[-=(_/]/.test(norm(r.model).slice(w.length)))
    .sort((a, b) => live(b) - live(a) || a.model.length - b.model.length)[0];
  if (suffix) return { ...suffix, exact: false };
  let best = null;
  for (const r of list) {
    const c = norm(r.model);
    let n = 0;
    while (n < Math.min(c.length, w.length) && c[n] === w[n]) n++;
    const score = n / Math.max(c.length, w.length);
    if (score >= 0.85 && (!best || score > best.score)) best = { ...r, score, exact: false };
  }
  return best;
}

/** პროდუქტის გვერდის გალერეა → სრული ფოტოების ბმულები (ზომის პარამეტრით) */
function gallery(html) {
  const start = html.indexOf('id="gallery"');
  if (start < 0) return [];
  const block = html.slice(start, html.indexOf('id="thumbs"', start) > 0 ? html.indexOf('id="thumbs"', start) : start + 20000);
  const urls = [...block.matchAll(/<img[^>]*src="(https:\/\/material[^"]+)"/g)].map((m) => m[1]);
  return [...new Set(urls)]
    .filter((u) => /\.(png|jpe?g|webp)$/i.test(u))
    .slice(0, 4)
    .map((u) => u.replace(/_thumb(\.\w+)$/i, "$1").replace(/ /g, "%20") + RESIZE);
}

async function alive(url) {
  try {
    const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

/** --near: ზუსტი მოდელი საიტზე არ არის (რეგიონული ვარიანტი) — იმავე სერიის უახლოესი მოდელის ფოტო */
const NEAR = args.includes("--near");
function nearest(list, wanted) {
  const w = norm(wanted);
  let best = null;
  for (const r of list) {
    const c = norm(r.model);
    let n = 0;
    while (n < Math.min(c.length, w.length) && c[n] === w[n]) n++;
    const score = n / w.length;
    if (score >= 0.7 && (!best || score > best.score)) best = { ...r, score, exact: false };
  }
  return best;
}

async function find(model) {
  const tried = new Set();
  const base = withoutPal(model);
  // უახლოესისთვის: მოდელის ბოლო ნაწილებს რიგრიგობით ვაკლებთ („IPC-HFW1439TL1-A-IL“ → „IPC-HFW1439TL1-A“ → „IPC-HFW1439TL1“)
  const shorter = NEAR ? base.split("-").map((_, i, p) => p.slice(0, p.length - i).join("-")).filter((k) => k.split("-").length >= 2 && k !== base) : [];
  for (const keyword of [model, base, ...shorter]) {
    if (tried.has(keyword)) continue;
    tried.add(keyword);
    const html = await get(`${SITE}/search/products?keyword=${encodeURIComponent(keyword)}`);
    const hit = keyword === model || keyword === base ? pick(results(html), keyword) : nearest(results(html), base);
    await sleep(350);
    if (!hit) continue;
    // სვიჩები ცალკე საიტზეა (transmission.dahuasecurity.com) — ბმული სრულია და გალერეა სხვანაირია
    const page = /^https?:/.test(hit.href) ? hit.href : SITE + hit.href;
    let images = [];
    try {
      images = gallery(await get(page.replace(/ /g, "%20")));
    } catch {
      /* გვერდი ვერ გაიხსნა — ძებნის შედეგის ფოტო მაინც გვაქვს */
    }
    await sleep(350);
    if (!images.length && hit.img) images = [hit.img.replace(/_thumb(\.\w+)$/i, "$1").replace(/ /g, "%20") + RESIZE];
    if (!images.length) continue;
    // სრული ზომა ყველა ფაილს არ აქვს — მაშინ პატარა (400 px) ვერსია რჩება
    const ok = [];
    for (const u of images) {
      // არსებობას ორიგინალზე ვამოწმებთ — ზომის შეცვლას სერვერი რამდენიმე წამს ანდომებს
      if (await alive(u.replace(RESIZE, ""))) ok.push(u);
      else {
        const thumb = u.replace(RESIZE, "").replace(/(\.\w+)$/, "_thumb$1");
        if (await alive(thumb)) ok.push(thumb);
      }
    }
    if (ok.length) return { page, matched: hit.model, exact: hit.exact && keyword === model, images: ok };
  }
  return null;
}

const data = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const models = [...new Set(files.flatMap(modelsFrom))].filter((m) => !only || only.has(m.toUpperCase()));
let found = 0, missing = 0, skipped = 0;
const queue = [...models.entries()];
async function worker() {
  for (let next = queue.shift(); next; next = queue.shift()) {
    const [i, model] = next;
    if (!FORCE && data[model]?.images?.length) { skipped++; continue; }
    try {
      const r = await find(model);
      if (r) { data[model] = r; found++; }
      else { data[model] = { images: [] }; missing++; }
      console.log(`${String(i + 1).padStart(3)}/${models.length} ${r ? (r.exact ? "✓" : "≈") : "—"} ${model}${r && !r.exact ? "  →  " + r.matched : ""}`);
    } catch (e) {
      console.log(`${String(i + 1).padStart(3)}/${models.length} ! ${model}: ${e.message}`);
    }
    if ((found + missing) % 10 === 0) fs.writeFileSync(OUT, JSON.stringify(data, null, 1));
  }
}
// ოთხი ერთდროულად — საიტი ნელია (≈3 წმ მოთხოვნაზე), მეტი კი უხეშობა იქნებოდა
await Promise.all(Array.from({ length: 4 }, worker));
fs.writeFileSync(OUT, JSON.stringify(data, null, 1));
console.log(`\nმოდელი: ${models.length} | ნაპოვნია: ${found} | ვერ ვიპოვე: ${missing} | უკვე იყო: ${skipped}\n→ ${OUT}`);
