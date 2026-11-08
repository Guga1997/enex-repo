import Link from "@/components/Link";
import { getCategoryTree } from "@/lib/category-tree";
import { cablesSegment } from "@/lib/cables";
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
  const { roots } = await getCategoryTree();
  // „კაბელები“ ენერგოს მერე — ვირტუალური სეგმენტი, კაბელები თავიანთ ადგილასაც რჩება
  const cables = cablesSegment(roots);
  const categories = cables ? [...roots.slice(0, 1), cables, ...roots.slice(1)] : roots;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="container-x flex h-16 items-center gap-2 sm:gap-4">
        <Link href="/" className="shrink-0 text-ink" aria-label={t("Enex — მთავარი")}>
          <Logo className="h-9 w-auto" />
        </Link>

        <div className="hidden flex-1 md:block">
          <SearchBox />
        </div>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          {/* ტელეფონზე კატეგორიების ზოლი ქვემოთაა — „კატალოგი“ ადგილს არ იკავებს */}
          <Link href="/catalog" className="hidden rounded-lg px-3 py-2 text-muted transition hover:bg-canvas hover:text-ink sm:block">
            {t("კატალოგი")}
          </Link>
          <Link
            href="/sale"
            className="hidden rounded-lg px-3 py-2 font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 lg:block"
          >
            {t("ფასდაკლებული პროდუქტები")}
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
        <div className="container-x flex items-stretch gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* ფასდაკლებები — ზედა ნავიგაციაში ადგილი მხოლოდ დიდ ეკრანზეა, პატარაზე ზოლის თავშია */}
          <Link
            href="/sale"
            className="flex min-w-20 flex-col items-center justify-center gap-1 whitespace-nowrap border-b-2 border-transparent px-4 pt-1.5 pb-1.5 text-xs font-medium text-red-600 dark:text-red-400 lg:hidden"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
                <path d="M3 12.6V4.5A1.5 1.5 0 0 1 4.5 3h8.1a1.5 1.5 0 0 1 1.06.44l7.4 7.4a1.5 1.5 0 0 1 0 2.12l-8.1 8.1a1.5 1.5 0 0 1-2.12 0l-7.4-7.4A1.5 1.5 0 0 1 3 12.6z" />
                <circle cx="7.5" cy="7.5" r="1.5" />
              </svg>
            </span>
            {t("ფასდაკლებები")}
          </Link>
          {categories.map((segment) => {
            const theme = segmentTheme(segment.nameKa, segment.slug);
            return (
            <div key={segment.id} className="group static lg:min-w-0 lg:flex-1">
              <NavSegment name={nameOf(segment, locale)} slug={segment.slug} />

              {segment.children.length > 0 && (
                /* ზოლს სქროლბარი აქვს და ჩამონათვალამდე 15px მკვდარი ზოლი რჩება.
                   მაუსი რომ მას გადაკვეთს, hover წყდება და მენიუ ქრება — ამიტომ
                   ორი რამ: დახურვა ოდნავ ყოვნდება და ზემოთ უხილავი „ხიდია“,
                   რომელიც სწორედ ამ ზოლს ფარავს. */
                <div className="invisible absolute left-0 right-0 top-full z-50 border-b border-line bg-surface opacity-0 shadow-xl transition-[opacity,visibility] delay-200 duration-150 before:absolute before:inset-x-0 before:-top-5 before:h-5 before:content-[''] group-hover:visible group-hover:opacity-100 group-hover:delay-0">
                  {/* სვეტებად (და არა რიგებად), რომ გრძელმა სიამ დანარჩენები არ ჩამოწიოს;
                      ჰედერი ფიქსირებულია — რაც ეკრანს სცდება, მენიუს შიგნით გადაიხვევა */}
                  <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto">
                  <div className="container-x gap-x-8 pt-7 pb-1 sm:columns-2 lg:columns-4">
                    {segment.children.map((group, i) => (
                      <div key={group.id} className="group/item mb-6 flex break-inside-avoid items-start gap-3">
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
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>

      {/* ტელეფონზე ზედა ზოლში ენის ადგილი არ არის — ძებნის გვერდით */}
      <div className="container-x flex items-center gap-2 pb-3 md:hidden">
        <div className="min-w-0 flex-1">
          <SearchBox />
        </div>
        <LangSwitcher className="shrink-0 sm:hidden" />
      </div>
    </header>
  );
}
