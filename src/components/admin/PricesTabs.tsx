import Link from "next/link";

/** „პროდუქციის ფასების“ ორი ჩანართი — წესები და ცალკეული პროდუქტები */
export default function PricesTabs({ active }: { active: "rules" | "products" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${on ? "bg-brand-500 text-white" : "text-muted hover:bg-canvas hover:text-ink"}`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex gap-1">
      {tab("/admin/prices", "წესები და საფეხურები", active === "rules")}
      {tab("/admin/prices/products", "პროდუქტები", active === "products")}
    </div>
  );
}
