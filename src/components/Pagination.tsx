"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/components/LocaleProvider";

export default function Pagination({ page, pages }: { page: number; pages: number }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  if (pages <= 1) return null;

  const go = (p: number) => {
    const next = new URLSearchParams(sp.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  // 1 ... p-1 p p+1 ... last
  const nums = new Set<number>([1, pages, page, page - 1, page + 1]);
  const list = [...nums].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

  return (
    <nav className="mt-8 flex items-center justify-center gap-1">
      <button
        onClick={() => go(page - 1)}
        disabled={page === 1}
        className="btn btn-outline disabled:opacity-40"
        aria-label={t("წინა გვერდი")}
      >
        &lsaquo;
      </button>
      {list.map((n, i) => (
        <span key={n} className="flex items-center gap-1">
          {i > 0 && list[i - 1] !== n - 1 && <span className="px-1 text-muted">&hellip;</span>}
          <button
            onClick={() => go(n)}
            aria-current={n === page ? "page" : undefined}
            className={`btn min-w-10 ${n === page ? "btn-primary" : "btn-outline"}`}
          >
            {n}
          </button>
        </span>
      ))}
      <button
        onClick={() => go(page + 1)}
        disabled={page === pages}
        className="btn btn-outline disabled:opacity-40"
        aria-label={t("შემდეგი გვერდი")}
      >
        &rsaquo;
      </button>
    </nav>
  );
}
