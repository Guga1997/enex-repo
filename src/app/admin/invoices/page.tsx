import { requireStaff } from "@/lib/auth";
import InvoiceBuilder from "@/components/admin/InvoiceBuilder";

export const dynamic = "force-dynamic";
export const metadata = { title: "ინვოისის გამოწერა" };

export default async function NewInvoicePage() {
  await requireStaff("/admin/invoices");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">ინვოისის გამოწერა</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          აირჩიე პროდუქტები და შეავსე მყიდველის მონაცემები. გამოიწერება ჩვეულებრივი შეკვეთა საბანკო გადარიცხვით:
          ფასი საიტისაა, მარაგში მყოფი ნაშთი 3 დღით იკავება, შეკვეთა პროცესში ჩნდება.
        </p>
      </div>
      <InvoiceBuilder />
    </div>
  );
}
