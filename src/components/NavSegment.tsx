"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CategoryIcon from "./CategoryIcon";
import { segmentTheme } from "@/lib/segment-theme";

/**
 * ნავიგაციის ზოლის ერთი სეგმენტი.
 * მაუსის მიტანაზე ხატულის უჯრა მიმართულების ფერში იღებება, ხატულა კი იმავე
 * ფერის მუქი ტონით რჩება — ანუ ფონზე კარგად ჩანს.
 */
export default function NavSegment({ name, slug }: { name: string; slug: string }) {
  const pathname = usePathname();
  const active = pathname === `/catalog/${slug}` || pathname.startsWith(`/catalog/${slug}/`);
  const t = segmentTheme(name, slug);

  return (
    <Link
      href={`/catalog/${slug}`}
      className={`flex h-full min-w-20 flex-col items-center justify-center gap-1 whitespace-nowrap border-b-2 px-4 pt-1.5 pb-1.5 text-xs transition ${
        active ? `${t.line} text-ink` : `border-transparent text-muted ${t.lineHover} group-hover:text-ink`
      }`}
    >
      <span
        className={`flex size-9 items-center justify-center rounded-xl transition ${
          active ? `${t.tint} ${t.ink}` : `bg-canvas text-muted ${t.tintHover} ${t.inkHover}`
        }`}
      >
        <CategoryIcon name={name} slug={slug} className="size-5" />
      </span>
      {name}
    </Link>
  );
}
