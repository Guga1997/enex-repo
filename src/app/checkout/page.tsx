import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CheckoutForm from "@/components/CheckoutForm";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "შეკვეთის გაფორმება" };

export default async function CheckoutPage() {
  const user = await getCurrentUser();

  // შესულ მომხმარებელს ველები წინასწარ ევსება და ორგანიზაციას ირჩევს
  const organizations = user
    ? await db.organization.findMany({
        where: { userId: user.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { id: true, name: true, taxId: true, isDefault: true },
      })
    : [];

  return (
    <>
      <Suspense>
        <Header />
      </Suspense>
      <main className="container-x py-8">
        <h1 className="mb-6 text-2xl font-bold">შეკვეთის გაფორმება</h1>
        <CheckoutForm
          user={
            user
              ? {
                  name: user.name,
                  email: user.email,
                  phone: user.phone,
                  taxId: user.taxId,
                  address: user.address,
                  type: user.type,
                }
              : null
          }
          organizations={organizations}
        />
      </main>
      <Footer />
    </>
  );
}
