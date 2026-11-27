"use client";

import Link from "@/components/Link";
import { usePath } from "./LocaleProvider";
import CategoryIcon from "./CategoryIcon";
import { segmentTheme } from "@/lib/segment-theme";

/**
 * ნავიგაციის ზოლის ერთი სეგმენტი. ტელეფონზე ხატულა წარწერის ზემოთაა (გადასახვევი ზოლი),
 * დიდ ეკრანზე — მარცხნივ: ზოლი იქ ორ რიგად დგას და ასე ნაკლებ სიმაღლეს იკავებს.
 * მაუსის მიტანაზე ხატულის უჯრა მიმართულების ფერში იღებება, ხატულა კი იმავე
 * ფერის მუქი ტონით რჩება — ანუ ფონზე კარგად ჩანს.
 */
export default function NavSegment({ name, slug }: { name: string; slug: string }) {
  const pathname = usePath();
  const active = pathname === `/catalog/${slug}` || pathname.startsWith(`/catalog/${slug}/`);
  const t = segmentTheme(name, slug);

  return (
    <Link
      href={`/catalog/${slug}`}
      className={`flex h-full min-w-20 flex-col items-center justify-start gap-1 whitespace-nowrap border-b-2 px-4 pt-1.5 pb-1.5 text-center text-xs leading-tight transition lg:min-w-0 lg:flex-row lg:items-center lg:justify-start lg:gap-1.5 lg:whitespace-normal lg:px-1 lg:text-left lg:text-[11px] xl:gap-2 xl:px-2 xl:text-xs ${
        active ? `${t.line} text-ink` : `border-transparent text-muted ${t.lineHover} group-hover:text-ink`
      }`}
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition lg:size-7 xl:size-8 ${
          active ? `${t.tint} ${t.ink}` : `bg-canvas text-muted ${t.tintHover} ${t.inkHover}`
        }`}
      >
        <CategoryIcon name={name} slug={slug} className="size-5" />
      </span>
      {name}
    </Link>
  );
}
