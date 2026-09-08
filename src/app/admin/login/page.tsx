import { redirect } from "next/navigation";
import { createSession, verifyLogin } from "@/lib/auth";

export const metadata = { title: "შესვლა" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const target = String(formData.get("next") ?? "/admin");

    const session = await verifyLogin(email, password);
    if (!session) redirect(`/admin/login?error=1&next=${encodeURIComponent(target)}`);

    await createSession(session);
    redirect(target);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={login} className="card w-full max-w-sm space-y-4 p-8">
        <h1 className="text-xl font-bold">ადმინ პანელი</h1>

        <input type="hidden" name="next" value={next ?? "/admin"} />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">ელფოსტა</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">პაროლი</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            ელფოსტა ან პაროლი არასწორია.
          </p>
        )}

        <button className="btn btn-primary w-full hover:bg-brand-600">შესვლა</button>
      </form>
    </main>
  );
}
