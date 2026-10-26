import { redirect } from "next/navigation";
import { titleMeta } from "@/lib/i18n/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ResetForm from "@/components/ResetForm";
import { getCurrentUser } from "@/lib/customer-auth";

export const generateMetadata = titleMeta("ახალი პაროლი");

/**
 * გვერდი კოდის გამოთხოვის გარეშეც იხსნება — ასე არ ვამხელთ, არსებობს თუ არა
 * ანგარიში: ორივე შემთხვევაში ერთი და იგივე ფორმა ჩანს.
 */
export default async function ResetPage() {
  if (await getCurrentUser()) redirect("/account");

  return (
    <>
      <Header />
      <main className="container-x py-10">
        <div className="mx-auto max-w-sm">
          <ResetForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
