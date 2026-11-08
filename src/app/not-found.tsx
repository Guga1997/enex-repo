import { Suspense } from "react";
import Link from "@/components/Link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getT } from "@/lib/i18n/server";

/** 404 — საიტის სახით (ჰედერი, ძებნა, ფუტერი) და მიმდინარე ენაზე, Next-ის ცარიელი გვერდის ნაცვლად */
export const metadata = { title: "404", robots: { index: false, follow: true } };

export default async function NotFound() {
  const t = await getT();
  return (
    <>
      <Suspense>
        <Header />
      </Suspense>
      <main className="container-x flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl font-bold text-brand-600">404</div>
        <h1 className="mt-3 text-xl font-bold">{t("გვერდი ვერ მოიძებნა")}</h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          {t("შესაძლოა პროდუქტი აღარ იყიდება ან ბმული შეიცვალა. სცადე ძებნა ან კატალოგი.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/catalog" className="btn btn-primary px-5 py-2.5">{t("კატალოგში გადასვლა")}</Link>
          <Link href="/" className="btn btn-outline px-5 py-2.5">{t("მთავარი")}</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
