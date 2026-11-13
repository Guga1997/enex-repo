import { notFound } from "next/navigation";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/config";
import LegalText from "@/components/LegalText";
import { PAGES, type Page } from "@/content/pages";
import { returns } from "@/content/legal/returns";
import { privacy } from "@/content/legal/privacy";
import { terms } from "@/content/legal/terms";
import { alts } from "@/lib/seo";

export const dynamic = "force-dynamic";


/** იურიდიული დოკუმენტები — სათაურებით, სიებით და ცხრილებით (LegalText) */
const LEGAL: Record<string, Record<Locale, Page>> = { returns, privacy, terms };

export function generateStaticParams() {
  return [...Object.keys(PAGES), ...Object.keys(LEGAL)].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  return {
    title: (PAGES[slug] ?? LEGAL[slug])?.[locale]?.title ?? "Enex",
    alternates: alts(`/page/${slug}`, locale),
  };
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  const legal = LEGAL[slug]?.[locale];
  if (legal) {
    return (
      <>
        <Suspense>
          <Header />
        </Suspense>
        <main className="container-x max-w-3xl py-10">
          <h1 className="mb-6 text-2xl font-bold">{legal.title}</h1>
          <div className="card p-6">
            <LegalText body={legal.body} />
          </div>
        </main>
        <Footer />
      </>
    );
  }
  const page = PAGES[slug]?.[locale];
  if (!page) notFound();

  return (
    <>
      <Suspense>
        <Header />
      </Suspense>
      <main className="container-x max-w-3xl py-10">
        <h1 className="mb-6 text-2xl font-bold">{page.title}</h1>
        <div className="card whitespace-pre-line p-6 text-sm leading-relaxed">{page.body}</div>
      </main>
      <Footer />
    </>
  );
}
