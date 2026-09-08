import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = { title: "შეკვეთის მოძებნა" };

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function find(formData: FormData) {
    "use server";
    const number = String(formData.get("number") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();

    const order = await db.order.findUnique({ where: { number } });
    // ორივე უნდა დაემთხვეს — მხოლოდ ნომრით სხვისი შეკვეთა არ უნდა გაიხსნას
    if (!order || order.customerEmail.toLowerCase() !== email) {
      redirect("/order/track?error=1");
    }
    redirect(`/order/${order.id}`);
  }

  return (
    <>
      <Suspense>
        <Header />
      </Suspense>
      <main className="container-x max-w-md py-12">
        <h1 className="mb-2 text-2xl font-bold">შეკვეთის მოძებნა</h1>
        <p className="mb-6 text-sm text-muted">
          შეიყვანეთ შეკვეთის ნომერი და ელფოსტა, რომელიც შეკვეთისას მიუთითეთ.
        </p>

        <form action={find} className="card space-y-4 p-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">შეკვეთის ნომერი</span>
            <input
              name="number"
              required
              placeholder="ORD-2026-00001"
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">ელფოსტა</span>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              შეკვეთა ვერ მოიძებნა. შეამოწმეთ ნომერი და ელფოსტა.
            </p>
          )}

          <button className="btn btn-primary w-full hover:bg-brand-600">მოძებნა</button>
        </form>
      </main>
      <Footer />
    </>
  );
}
