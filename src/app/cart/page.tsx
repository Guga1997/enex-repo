import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartView from "@/components/CartView";

export const metadata = { title: "კალათა" };

export default function CartPage() {
  return (
    <>
      <Suspense>
        <Header />
      </Suspense>
      <main className="container-x py-8">
        <h1 className="mb-6 text-2xl font-bold">კალათა</h1>
        <CartView />
      </main>
      <Footer />
    </>
  );
}
