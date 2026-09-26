import Link from "@/components/Link";
import { db } from "@/lib/db";
import Logo from "./Logo";
import CartButton from "./CartButton";
import SearchBox from "./SearchBox";
import AccountButton from "./AccountButton";
import NavSegment from "./NavSegment";
import ThemeToggle from "./ThemeToggle";
import LangSwitcher from "./LangSwitcher";
import { getI18n } from "@/lib/i18n/server";
import { nameOf } from "@/lib/i18n/content";

export default async function Header() {
  const { locale, t } = await getI18n();
  // სამი დონე ერთი მოთხოვნით: სეგმენტი → ქვეჯგუფი → ქვე-ქვეჯგუფი
  const categories = await db.category.findMany({
    where: { parentId: null, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          children: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="container-x flex h-16 items-center gap-4">
        <Link href="/" className="shrink-0 text-ink" aria-label={t("Enex — მთავარი")}>
          <Logo className="h-9 w-auto" />
        </Link>

        <div className="hidden flex-1 md:block">
          <SearchBox />
        </div>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/catalog" className="rounded-lg px-3 py-2 text-muted transition hover:bg-canvas hover:text-ink">
            {t("კატალოგი")}
          </Link>
          <Link
            href="/generators"
            className="hidden rounded-lg px-3 py-2 text-muted transition hover:bg-canvas hover:text-ink lg:block"
          >
            {t("გენერატორები")}
          </Link>
          <Link
            href="/hotel"
            className="hidden rounded-lg px-3 py-2 text-muted transition hover:bg-canvas hover:text-ink lg:block"
          >
            {t("სასტუმროსთვის")}
          </Link>
          <Link
            href="/order/track"
            className="hidden rounded-lg px-3 py-2 text-muted transition hover:bg-canvas hover:text-ink sm:block"
          >
            {t("შეკვეთის მოძებნა")}
          </Link>
          <LangSwitcher className="hidden sm:flex" />
          <ThemeToggle />
          <AccountButton />
          <CartButton />
        </nav>
      </div>

      {/* სეგმენტების ზოლი — hover-ზე იშლება ქვეჯგუფები და მათი ქვეჯგუფები */}
      <div className="border-t border-line bg-surface">
        <div className="container-x flex items-stretch gap-1 overflow-x-auto">
          {categories.map((segment) => (
            <div key={segment.id} className="group static">
              <NavSegment name={nameOf(segment, locale)} slug={segment.slug} />

              {segment.children.length > 0 && (
                <div className="invisible absolute left-0 right-0 top-full z-50 border-b border-line bg-surface opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100">
                  <div className="container-x grid gap-x-8 gap-y-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
                    {segment.children.map((group) => (
                      <div key={group.id}>
                        <Link
                          href={`/catalog/${group.slug}`}
                          className="block text-sm font-semibold text-ink transition hover:text-brand-600"
                        >
                          {nameOf(group, locale)}
                        </Link>
                        {group.children.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {group.children.map((leaf) => (
                              <li key={leaf.id}>
                                <Link
                                  href={`/catalog/${leaf.slug}`}
                                  className="block text-sm leading-6 text-muted transition hover:text-brand-600"
                                >
                                  {nameOf(leaf, locale)}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="container-x pb-3 md:hidden">
        <SearchBox />
      </div>
    </header>
  );
}
