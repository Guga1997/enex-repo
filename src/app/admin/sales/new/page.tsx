import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import InvoiceBuilder from "@/components/admin/InvoiceBuilder";

export const dynamic = "force-dynamic";
export const metadata = { title: "ახალი გაყიდვა" };

export default async function NewSalePage() {
  await requireStaff("/admin/sales");
  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/sales" className="text-sm text-muted hover:text-brand-600">← მაღაზიის გაყიდვები</Link>
        <h1 className="text-2xl font-bold">ახალი გაყიდვა</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          აირჩიე ნივთი საიტიდან ან ჩაწერე სხვა ნივთი ხელით, მიუთითე მყიდველი და შეინახე. მარაგში მყოფი ნივთი 3 დღით
          იკავება; ფულის მიღების შემდეგ სიაში დააჭირე „გაიყიდა“ — ნაშთი მაშინ ჩამოიწერება.
        </p>
      </div>
      <InvoiceBuilder mode="store" />
    </div>
  );
}
