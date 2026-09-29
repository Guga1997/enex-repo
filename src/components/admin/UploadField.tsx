"use client";

import { useRef, useState } from "react";

/**
 * ერთი ფაილის ატვირთვა ფორმის შიგნით.
 *
 * ფაილი მიდის /api/admin/upload-ზე და დაბრუნებული მისამართი ჯდება დამალულ
 * ველში — ასე სერვერული action-ი ჩვეულებრივ ტექსტს იღებს და ფაილის ატვირთვა
 * ფორმის გაგზავნას არ აყოვნებს.
 */
export default function UploadField({
  name,
  label,
  accept = ".pdf,image/*",
}: {
  name: string;
  label: string;
  accept?: string;
}) {
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ატვირთვა ვერ მოხერხდა");
        return;
      }
      setUrl(data.files?.[0]?.url ?? data.urls?.[0] ?? "");
      setFileName(file.name);
    } catch {
      setError("ატვირთვა ვერ მოხერხდა — სცადე თავიდან");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input type="hidden" name={name} value={url} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="btn btn-outline px-3 py-2 text-sm"
        >
          {busy ? "იტვირთება…" : url ? "სხვა ფაილი" : "ფაილის არჩევა"}
        </button>
        {url && (
          <a href={url} target="_blank" rel="noopener" className="text-sm text-brand-600 hover:underline">
            {fileName || "ატვირთული ფაილი"} ↗
          </a>
        )}
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
    </div>
  );
}
