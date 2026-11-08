"use client";

import { useEffect } from "react";
import { useT } from "@/components/LocaleProvider";

/** გვერდის შეცდომა — მყიდველი ცარიელ „Application error“-ს აღარ ხედავს, თავიდან ცდა შეუძლია */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="container-x flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <h1 className="text-xl font-bold">{t("რაღაც ვერ გამოვიდა")}</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        {t("გვერდი ვერ ჩაიტვირთა. სცადე თავიდან — თუ ისევ გამეორდა, დაგვიკავშირდი.")}
      </p>
      {error.digest && <p className="mt-1 text-xs text-muted">#{error.digest}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="btn btn-primary px-5 py-2.5">{t("თავიდან ცდა")}</button>
        <a href="/" className="btn btn-outline px-5 py-2.5">{t("მთავარი")}</a>
      </div>
    </main>
  );
}
