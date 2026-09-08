"use client";

import { useRef, useState } from "react";

const field =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500";

/**
 * datasheet-ის ატვირთვა: ფაილი მიდის /api/admin/upload-ზე, დაბრუნებული
 * მისამართი და ზომა კი ივსება ფორმაში, რომელსაც სერვერული action ინახავს.
 */
export default function DocumentUploader({
  productId,
  action,
}: {
  productId: string;
  action: (formData: FormData) => void;
}) {
  const [url, setUrl] = useState("");
  const [size, setSize] = useState(0);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
      const uploaded = data.files?.[0];
      setUrl(uploaded?.url ?? data.urls?.[0] ?? "");
      setSize(uploaded?.size ?? file.size);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    } catch {
      setError("კავშირის შეცდომა");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-line p-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="url" value={url} />
      <input type="hidden" name="sizeBytes" value={size} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">ფაილი</span>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
            className="w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-sm"
          />
          {busy && <span className="mt-1 block text-xs text-muted">იტვირთება…</span>}
          {url && !busy && (
            <span className="mt-1 block text-xs text-emerald-700">
              ატვირთულია · {Math.round(size / 1024)} KB
            </span>
          )}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">დასახელება</span>
          <input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="ტექნიკური დოკუმენტაცია (datasheet)"
            className={field}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">ტიპი</span>
          <select name="kind" className={field}>
            <option value="DATASHEET">ტექნიკური დოკუმენტაცია</option>
            <option value="CERTIFICATE">სერტიფიკატი</option>
            <option value="MANUAL">ინსტრუქცია</option>
          </select>
        </label>

        <button
          disabled={!url || busy}
          className="btn btn-primary hover:bg-brand-600 disabled:opacity-50"
        >
          დამატება
        </button>
      </div>

      {error && <p className="rounded-lg bg-rose-50 p-2.5 text-sm text-rose-700">{error}</p>}
    </form>
  );
}
