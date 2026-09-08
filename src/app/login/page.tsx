import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoginForm from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/customer-auth";

export const metadata = { title: "შესვლა" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentUser()) redirect("/account");
  const { next } = await searchParams;

  return (
    <>
      <Header />
      <main className="container-x py-10">
        <div className="mx-auto max-w-sm space-y-4">
          <LoginForm next={next} />
          <p className="text-center text-sm text-muted">
            ანგარიში არ გაქვს?{" "}
            <Link href="/register" className="font-medium text-brand-600 hover:underline">
              რეგისტრაცია
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
