"use client";

import Image from "next/image";
import Link from "@/components/Link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/LocaleProvider";

export type Slide = {
  id: string;
  title: string;
  subtitle: string | null;
  image: string;
  href: string;
};

const INTERVAL_MS = 6000;

/**
 * მთავარი გვერდის სარეკლამო სლაიდერი. მთელი სლაიდი ბმულია — სურათზე სადაც არ
 * უნდა დააკლიკო, ბრენდის/სეგმენტის გვერდზე გადადიხარ. თვითონ ცვლის 6 წამში,
 * მაუსის ქვეშ ჩერდება; ისრები, წერტილები და თითით გადაფურცვლა.
 */
export default function HeroSlider({ slides }: { slides: Slide[] }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback((n: number) => setIndex(((n % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
    return () => clearInterval(t);
  }, [count, paused]);

  if (!count) return null;

  return (
    <section
      className="group relative mb-10 overflow-hidden rounded-2xl bg-nav"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
      aria-roledescription="carousel"
    >
      <div className="relative aspect-[16/9] w-full sm:aspect-[16/6] lg:aspect-[16/5]">
        {slides.map((s, i) => (
          <Link
            key={s.id}
            href={s.href}
            aria-hidden={i !== index}
            tabIndex={i === index ? 0 : -1}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === index ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <Image
              src={s.image}
              alt={s.title}
              fill
              priority={i === 0}
              sizes="(min-width: 1280px) 1200px, 100vw"
              className="object-cover"
            />
            {/* წარწერა რომ ნებისმიერ ფოტოზე იკითხებოდეს — მარცხნიდან მუქი გადასვლა */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent" />
            <div className="absolute inset-y-0 left-0 flex max-w-[80%] flex-col justify-center p-5 text-white sm:max-w-[60%] sm:py-10 sm:pl-16 sm:pr-8 lg:pl-20">
              <h2 className="text-lg font-bold leading-tight drop-shadow sm:text-3xl lg:text-4xl">{s.title}</h2>
              {s.subtitle && (
                <p className="mt-2 hidden text-sm text-white/85 drop-shadow sm:block lg:mt-3 lg:text-lg">{s.subtitle}</p>
              )}
              <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 sm:mt-5 sm:px-4 sm:py-2 sm:text-sm">
                {t("ნახვა →")}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label={t("წინა")}
            onClick={() => go(index - 1)}
            className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-lg text-ink opacity-0 transition hover:bg-white group-hover:opacity-100 sm:flex"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={t("შემდეგი")}
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-lg text-ink opacity-0 transition hover:bg-white group-hover:opacity-100 sm:flex"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`სლაიდი ${i + 1}`}
                onClick={() => go(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
