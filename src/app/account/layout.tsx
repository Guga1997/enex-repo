import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getCurrentUser } from "@/lib/customer-auth";
import { logoutAction } from "@/app/actions/customer";

const LINKS: { href: string; label: string }[] = [
  { href: "/account/orders?tab=current", label: "მიმდინარე შეკვეთები" },
  { href: "/account/orders?tab=done", label: "დასრულებული შეკვეთები" },
  { href: "/account/orders?tab=returned", label: "უკან დაბრუნებული" },
  { href: "/account/serials", label: "სერიული ნომრები" },
  { href: "/account/warranty", label: "გარანტია" },
  { href: "/account/favorites", label: "ჩემი ფავორიტები" },
  { href: "/account/organizations", label: "ყველა ორგანიზაცია" },
  { href: "/account/profile", label: "პერსონალური ინფორმაცია" },
  { href: "/account/password", label: "პაროლის შეცვლა" },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  return (
    <>
      <Header />
      <main className="container-x py-8">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-4">
            <div className="card p-4">
              <p className="font-medium">{user.name}</p>
              <p className="mt-0.5 text-sm text-muted">{user.email}</p>
              <p className="mt-2 text-sm">
                <span className="text-muted">ფასის დონე: </span>
                {user.priceTier === "DEALER" ? (
                  <span className="font-medium text-brand-600">სადილერო</span>
                ) : (
                  <span className="font-medium">საცალო</span>
                )}
              </p>
            </div>

            <nav className="card overflow-hidden p-2">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="block rounded-lg px-3 py-2 text-sm hover:bg-canvas"
                >
                  {l.label}
                </Link>
              ))}
              <form action={logoutAction} className="border-t border-line pt-2 mt-2">
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50">
                  გასვლა
                </button>
              </form>
            </nav>
          </aside>

          <section className="min-w-0">{children}</section>
        </div>
      </main>
      <Footer />
    </>
  );
}
