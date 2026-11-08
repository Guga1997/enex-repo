import { createHash } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { mkdir, stat, writeFile } from "fs/promises";
import path from "path";
import { db } from "./db";

/**
 * მიმწოდებლის ფაილების ჩვენს დისკზე გადმოტანა.
 *
 * intellcom hotlink-ს კრძალავს, და ზოგადადაც: უცხო სერვერზე დამოკიდებული სურათი
 * კატალოგში ერთ დღეს გაქრება. ფაილს URL-ის ჰეშით ვინახავთ — ერთი და იგივე
 * მისამართი ორჯერ არ ჩამოიტვირთება, გამეორება უსაფრთხოა.
 */

const ROOT = path.join(process.cwd(), "public", "uploads");
const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_DOC = 40 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/zip": ".zip",
};

export const isRemote = (url: string) => /^https?:\/\//i.test(url);

/**
 * შიდა ქსელის მისამართი? მიმწოდებლის ფიდში ჩადებული ბმული (ან გადამისამართება) სერვერს
 * localhost-ზე ან Hetzner-ის metadata-ზე (169.254.169.254) არ უნდა გაუშვებდეს — პასუხი
 * საჯარო /uploads-ში ჩაიწერებოდა.
 */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
}

async function assertPublicUrl(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("მხოლოდ http(s)");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("შიდა ქსელის მისამართი");
}

/** ფაილის თავი ემთხვევა თუ არა გამოცხადებულ ტიპს — HTML/სკრიპტი სურათად არ ჩაიწეროს */
export function sniffOk(buf: Buffer, ext: string): boolean {
  const hex = buf.subarray(0, 12).toString("hex");
  const ascii = buf.subarray(0, 12).toString("latin1");
  switch (ext) {
    case ".jpg": return hex.startsWith("ffd8ff");
    case ".png": return hex.startsWith("89504e47");
    case ".gif": return ascii.startsWith("GIF8");
    case ".webp": return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
    case ".avif": return ascii.slice(4, 8) === "ftyp";
    case ".pdf": return ascii.startsWith("%PDF");
    case ".doc": case ".xls": return hex.startsWith("d0cf11e0");
    case ".docx": case ".xlsx": case ".zip": return ascii.startsWith("PK");
    default: return false;
  }
}

async function exists(p: string) {
  try { await stat(p); return true; } catch { return false; }
}

/** გაფართოება ჯერ პასუხის ტიპიდან, მერე მისამართიდან */
function pickExt(contentType: string | null, url: string): string | null {
  const ct = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (EXT[ct]) return EXT[ct];
  const m = url.match(/\.(jpe?g|png|webp|gif|avif|pdf|docx?|xlsx?|zip)(?:\?|$)/i);
  return m ? "." + m[1].toLowerCase().replace("jpeg", "jpg") : null;
}

export type FetchResult =
  | { ok: true; localUrl: string; bytes: number; cached: boolean }
  | { ok: false; error: string };

/**
 * ერთი ფაილის ჩამოტვირთვა `public/uploads/<kind>/<hash><ext>`-ში.
 * აბრუნებს საიტის შიდა მისამართს — `/uploads/...`.
 */
export async function fetchToUploads(
  url: string,
  kind: "products" | "docs"
): Promise<FetchResult> {
  if (!isRemote(url)) return { ok: true, localUrl: url, bytes: 0, cached: true };

  const hash = createHash("sha1").update(url).digest("hex").slice(0, 24);
  const dir = path.join(ROOT, kind);
  await mkdir(dir, { recursive: true });

  // უკვე ჩამოტვირთულია? ნებისმიერი გაფართოებით
  for (const ext of new Set(Object.values(EXT))) {
    if (await exists(path.join(dir, hash + ext))) {
      return { ok: true, localUrl: `/uploads/${kind}/${hash}${ext}`, bytes: 0, cached: true };
    }
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // გადამისამართებას ხელით მივყვებით — ყოველ ნაბიჯზე მისამართი მოწმდება
    let current = url;
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      await assertPublicUrl(current);
      const r = await fetch(current, {
        signal: ctrl.signal,
        redirect: "manual",
        headers: { "User-Agent": "enex.ge catalog sync" },
      });
      const loc = r.status >= 300 && r.status < 400 ? r.headers.get("location") : null;
      if (!loc) {
        res = r;
        break;
      }
      current = new URL(loc, current).toString();
    }
    if (!res) return { ok: false, error: "ძალიან ბევრი გადამისამართება" };
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const ext = pickExt(res.headers.get("content-type"), url);
    if (!ext) return { ok: false, error: `უცნობი ტიპი: ${res.headers.get("content-type")}` };

    const limit = kind === "products" ? MAX_IMAGE : MAX_DOC;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return { ok: false, error: "ცარიელი პასუხი" };
    if (buf.length > limit) return { ok: false, error: `ზომა ${Math.round(buf.length / 1048576)} მბ — ლიმიტს აჭარბებს` };
    if (!sniffOk(buf, ext)) return { ok: false, error: `შიგთავსი ${ext}-ს არ ჰგავს` };

    const file = path.join(dir, hash + ext);
    await writeFile(file, buf);
    return { ok: true, localUrl: `/uploads/${kind}/${hash}${ext}`, bytes: buf.length, cached: false };
  } catch (e) {
    const msg = e instanceof Error ? (e.name === "AbortError" ? "დრო ამოიწურა" : e.message) : String(e);
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export type LocalizeStats = {
  images: { done: number; cached: number; failed: number; bytes: number };
  docs: { done: number; cached: number; failed: number; bytes: number };
  errors: string[];
};

/** რამდენიმე პარალელური ჩამოტვირთვა — მიმწოდებლის სერვერს არ ვაწვებით */
async function pool<T>(items: T[], size: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/**
 * ყველა უცხო მისამართის გადმოტანა — სურათებიც და დოკუმენტებიც.
 * `productIds` მითითებისას მხოლოდ იმ პროდუქტებზე; უამისოდ მთელ კატალოგზე.
 * ჩავარდნილი მისამართი უცვლელი რჩება — შემდეგ გაშვებაზე ხელახლა ეცდება.
 */
export async function localizeMedia(opts: {
  productIds?: string[];
  /** დოკუმენტებიც ჩამოვიდეს? ნაგულისხმევად არა — გიგაბაიტებია და ბმულია, არა ჩაშენებული */
  docs?: boolean;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
} = {}): Promise<LocalizeStats> {
  const where = opts.productIds ? { productId: { in: opts.productIds } } : {};
  const [images, docs] = await Promise.all([
    db.productImage.findMany({ where: { ...where, url: { startsWith: "http" } } }),
    opts.docs
      ? db.productDocument.findMany({ where: { ...where, url: { startsWith: "http" } } })
      : Promise.resolve([]),
  ]);

  const stats: LocalizeStats = {
    images: { done: 0, cached: 0, failed: 0, bytes: 0 },
    docs: { done: 0, cached: 0, failed: 0, bytes: 0 },
    errors: [],
  };
  const total = images.length + docs.length;
  let progress = 0;
  const tick = () => opts.onProgress?.(++progress, total);

  await pool(images, opts.concurrency ?? 4, async (img) => {
    const r = await fetchToUploads(img.url, "products");
    if (r.ok) {
      await db.productImage.update({ where: { id: img.id }, data: { url: r.localUrl } });
      stats.images.done++;
      if (r.cached) stats.images.cached++;
      stats.images.bytes += r.bytes;
    } else {
      stats.images.failed++;
      if (stats.errors.length < 20) stats.errors.push(`${img.url} — ${r.error}`);
    }
    tick();
  });

  await pool(docs, opts.concurrency ?? 3, async (doc) => {
    const r = await fetchToUploads(doc.url, "docs");
    if (r.ok) {
      await db.productDocument.update({
        where: { id: doc.id },
        data: { url: r.localUrl, sizeBytes: r.bytes || undefined },
      });
      stats.docs.done++;
      if (r.cached) stats.docs.cached++;
      stats.docs.bytes += r.bytes;
    } else {
      stats.docs.failed++;
      if (stats.errors.length < 20) stats.errors.push(`${doc.url} — ${r.error}`);
    }
    tick();
  });

  return stats;
}
