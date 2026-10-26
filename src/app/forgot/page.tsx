import Link from "@/components/Link";
import { getT, titleMeta } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ForgotForm from "@/components/ForgotForm";
import { getCurrentUser } from "@/lib/customer-auth";

export const generateMetadata = titleMeta("პაროლის აღდგენა");

export default async function ForgotPage() {
  if (await getCurrentUser()) redirect("/account");
  const t = await getT();

  return (
    <>
      <Header />
      <main className="container-x py-10">
        <div className="mx-auto max-w-sm space-y-4">
          <ForgotForm />
          <p className="text-center text-sm text-muted">
            {t("გაგახსენდა?")}{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              {t("შესვლა")}
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
