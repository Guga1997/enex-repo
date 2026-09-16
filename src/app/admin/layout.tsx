import Link from "next/link";
import { getSession, destroySession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: { default: "ადმინ პანელი", template: "%s | ადმინ პანელი" } };

const NAV = [
  { href: "/admin", label: "მიმოხილვა" },
  { href: "/admin/products", label: "პროდუქტები" },
  { href: "/admin/categories", label: "კატეგორიები" },
  { href: "/admin/orders", label: "შეკვეთები" },
  { href: "/admin/suppliers", label: "მიმწოდებლები" },
  { href: "/admin/users", label: "მომხმარებლები" },
  { href: "/admin/stock", label: "სტოკის ლოგი" },
  { href: "/admin/api-keys", label: "API გასაღებები" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // login გვერდი — layout-ის გარეშე
  if (!session) return <>{children}</>;

  async function logout() {
    "use server";
    await destroySession();
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-line bg-white lg:block">
        <div className="border-b border-line p-5">
          <Link href="/admin" className="text-lg font-bold text-brand-600">
            ადმინ პანელი
          </Link>
        </div>
        <nav className="space-y-1 p-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-canvas"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <Link href="/" target="_blank" className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-canvas">
            საიტის ნახვა ↗
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-line bg-white px-5">
          <nav className="flex gap-1 overflow-x-auto lg:hidden">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-canvas">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/admin/account" className="text-muted hover:text-ink hover:underline">{session.name}</Link>
            <form action={logout}>
              <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-canvas">
                გასვლა
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-5">{children}</main>
      </div>
    </div>
  );
}
