import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RegisterForm from "@/components/RegisterForm";
import { getCurrentUser } from "@/lib/customer-auth";

export const metadata = { title: "რეგისტრაცია" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/account");

  return (
    <>
      <Header />
      <main className="container-x py-10">
        <div className="mx-auto max-w-2xl">
          <RegisterForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
