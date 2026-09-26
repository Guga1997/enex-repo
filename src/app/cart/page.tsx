import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartView from "@/components/CartView";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "კალათა" };

export default async function CartPage() {
  const t = await getT();
  return (
    <>
      <Suspense>
        <Header />
      </Suspense>
      <main className="container-x py-8">
        <h1 className="mb-6 text-2xl font-bold">{t("კალათა")}</h1>
        <CartView />
      </main>
      <Footer />
    </>
  );
}
