"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * სურათების ატვირთვა + რიგის მართვა.
 * ღირებულებას ინახავს ერთ hidden input-ში (ახალი ხაზით გამოყოფილი URL-ები),
 * რომ ჩვეულებრივი server action-ით შეინახოს.
 */
export default function ImageUploader({ name, initial }: { name: string; initial: string[] }) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);

    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);

    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "ატვირთვა ვერ მოხერხდა");
      else setUrls((prev) => [...prev, ...data.urls]);
    } catch {
      setError("ატვირთვა ვერ მოხერხდა");
    }
    setBusy(false);
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= urls.length) return;
    const next = [...urls];
    [next[i], next[j]] = [next[j], next[i]];
    setUrls(next);
  };

  return (
    <div>
      <input type="hidden" name={name} value={urls.join("\n")} />

      <div className="flex flex-wrap gap-3">
        {urls.map((url, i) => (
          <div key={url + i} className="relative size-24 rounded-lg border border-line bg-white">
            <Image src={url} alt="" fill className="object-contain p-1.5" />
            {i === 0 && (
              <span className="absolute left-1 top-1 rounded bg-brand-500 px-1 text-[10px] font-bold text-white">
                მთავარი
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 rounded-b-lg bg-white/90 py-0.5">
              <button type="button" onClick={() => move(i, -1)} className="px-1 text-xs text-muted hover:text-ink">
                ←
              </button>
              <button
                type="button"
                onClick={() => setUrls(urls.filter((_, k) => k !== i))}
                className="px-1 text-xs text-rose-600"
              >
                ✕
              </button>
              <button type="button" onClick={() => move(i, 1)} className="px-1 text-xs text-muted hover:text-ink">
                →
              </button>
            </div>
          </div>
        ))}

        <label className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-xs text-muted hover:border-brand-500 hover:text-brand-600">
          {busy ? "..." : "+ დამატება"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="hidden"
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      <p className="mt-2 text-xs text-muted">
        JPG, PNG, WebP ან AVIF — მაქსიმუმ 5MB. პირველი სურათი ჩანს კატალოგში.
      </p>
    </div>
  );
}
