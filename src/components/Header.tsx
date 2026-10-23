import Link from "@/components/Link";
import { getCategoryTree } from "@/lib/category-tree";
import { segmentTheme } from "@/lib/segment-theme";
import Logo from "./Logo";
import SubcategoryIcon from "./SubcategoryIcon";
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
  // სეგმენტი → ქვეჯგუფი → ქვე-ქვეჯგუფი; ყველა დონეზე სავსე წინ, ცარიელი ბოლოს
  const { roots: categories } = await getCategoryTree();

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
          {categories.map((segment) => {
            const theme = segmentTheme(segment.nameKa, segment.slug);
            return (
            <div key={segment.id} className="group static">
              <NavSegment name={nameOf(segment, locale)} slug={segment.slug} />

              {segment.children.length > 0 && (
                /* ზოლს სქროლბარი აქვს და ჩამონათვალამდე 15px მკვდარი ზოლი რჩება.
                   მაუსი რომ მას გადაკვეთს, hover წყდება და მენიუ ქრება — ამიტომ
                   ორი რამ: დახურვა ოდნავ ყოვნდება და ზემოთ უხილავი „ხიდია“,
                   რომელიც სწორედ ამ ზოლს ფარავს. */
                <div className="invisible absolute left-0 right-0 top-full z-50 border-b border-line bg-surface opacity-0 shadow-xl transition-[opacity,visibility] delay-200 duration-150 before:absolute before:inset-x-0 before:-top-5 before:h-5 before:content-[''] group-hover:visible group-hover:opacity-100 group-hover:delay-0">
                  <div className="container-x grid gap-x-8 gap-y-7 py-7 sm:grid-cols-2 lg:grid-cols-4">
                    {segment.children.map((group, i) => (
                      <div key={group.id} className="group/item flex items-start gap-3">
                        <Link
                          href={`/catalog/${group.slug}`}
                          tabIndex={-1}
                          aria-hidden
                          className={`flex size-11 shrink-0 items-center justify-center rounded-xl bg-canvas text-muted transition duration-300 group-hover/item:-translate-y-0.5 ${theme.tintItem} ${theme.inkItem}`}
                        >
                          <SubcategoryIcon name={group.nameKa} slug={group.slug} delayMs={i * 45} className="size-6" />
                        </Link>
                        <div className="min-w-0 pt-0.5">
                        <Link
                          href={`/catalog/${group.slug}`}
                          className="block text-sm font-semibold leading-5 text-ink transition hover:text-brand-600"
                        >
                          {nameOf(group, locale)}
                        </Link>
                        {group.children.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>

      <div className="container-x pb-3 md:hidden">
        <SearchBox />
      </div>
    </header>
  );
}
