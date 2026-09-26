import Link from "@/components/Link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoginForm from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/customer-auth";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "შესვლა" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getT();
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(next?.startsWith("/") ? next : "/account");

  return (
    <>
      <Header />
      <main className="container-x py-10">
        <div className="mx-auto max-w-sm space-y-4">
          <LoginForm next={next} />
          <p className="text-center text-sm text-muted">
            ანგარიში არ გაქვს?{" "}
            <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-brand-600 hover:underline">
              {t("რეგისტრაცია")}
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
