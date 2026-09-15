import { createHash } from "crypto";
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
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/zip": ".zip",
};

export const isRemote = (url: string) => /^https?:\/\//i.test(url);

async function exists(p: string) {
  try { await stat(p); return true; } catch { return false; }
}

/** გაფართოება ჯერ პასუხის ტიპიდან, მერე მისამართიდან */
function pickExt(contentType: string | null, url: string): string | null {
  const ct = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (EXT[ct]) return EXT[ct];
  const m = url.match(/\.(jpe?g|png|webp|gif|avif|svg|pdf|docx?|xlsx?|zip)(?:\?|$)/i);
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
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "enex.ge catalog sync" },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const ext = pickExt(res.headers.get("content-type"), url);
    if (!ext) return { ok: false, error: `უცნობი ტიპი: ${res.headers.get("content-type")}` };

    const limit = kind === "products" ? MAX_IMAGE : MAX_DOC;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return { ok: false, error: "ცარიელი პასუხი" };
    if (buf.length > limit) return { ok: false, error: `ზომა ${Math.round(buf.length / 1048576)} მბ — ლიმიტს აჭარბებს` };

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
