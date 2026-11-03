"use client";

import Image from "next/image";
import Link from "@/components/Link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/LocaleProvider";

export type BannerCard = { slug: string; image: string; title: string };

const INTERVAL_MS = 4000;

/**
 * სარეკლამო ბანერების კარუსელი — ბანერები თითქმის კვადრატულია და ტექსტი თვითონ აწერია,
 * ამიტომ მთლიანად ჩანს (HeroSlider ფართოა და ჭრის). დესკტოპზე სამი, ტელეფონზე ერთი;
 * თვითონ გადადის, მაუსის ქვეშ ჩერდება; ისრები და თითით გადაფურცვლა (scroll-snap).
 */
export default function BannerCarousel({ banners }: { banners: BannerCard[] }) {
  const t = useT();
  const track = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  const step = useCallback((dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const w = card ? card.offsetWidth + 16 : el.clientWidth;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    if (dir === 1 && atEnd) el.scrollTo({ left: 0, behavior: "smooth" });
    else if (dir === -1 && el.scrollLeft <= 4) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    else el.scrollBy({ left: dir * w, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (paused || banners.length < 2) return;
    const id = setInterval(() => step(1), INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, step, banners.length]);

  if (!banners.length) return null;

  return (
    <section
      className="group relative mb-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      aria-roledescription="carousel"
    >
      <div
        ref={track}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {banners.map((b, i) => (
          <Link
            key={b.slug}
            href={`/product/${b.slug}`}
            className="block w-full shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-surface transition hover:shadow-md sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]"
          >
            <Image
              src={b.image}
              alt={b.title}
              width={940}
              height={788}
              priority={i < 3}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="h-auto w-full"
            />
          </Link>
        ))}
      </div>

      {banners.length > 1 && (
        <>
          <button
            type="button"
            aria-label={t("წინა")}
            onClick={() => step(-1)}
            className="absolute left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg text-ink shadow transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={t("შემდეგი")}
            onClick={() => step(1)}
            className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg text-ink shadow transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
          >
            ›
          </button>
        </>
      )}
    </section>
  );
}
