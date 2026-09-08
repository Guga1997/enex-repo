"use client";

import Image from "next/image";
import { useState } from "react";

type Img = { url: string; alt: string };

export default function Gallery({ images }: { images: Img[] }) {
  const [active, setActive] = useState(0);

  if (!images.length) {
    return (
      <div className="card flex aspect-square items-center justify-center text-sm text-muted">
        სურათი არ არის
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="card relative aspect-square bg-white">
        <Image
          src={images[active].url}
          alt={images[active].alt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-contain p-8"
          priority
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.url + i}
              onClick={() => setActive(i)}
              aria-label={`სურათი ${i + 1}`}
              className={`relative size-20 shrink-0 rounded-lg border bg-white p-1 ${
                i === active ? "border-brand-500" : "border-line"
              }`}
            >
              <Image src={img.url} alt={img.alt} fill className="object-contain p-1.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
