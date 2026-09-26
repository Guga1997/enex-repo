import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VerifyForm from "@/components/VerifyForm";
import { getPendingUserId } from "@/app/actions/customer";
import { db } from "@/lib/db";
import { emailIsMocked } from "@/lib/notify/email";
import { smsIsMocked } from "@/lib/notify/sms";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "ანგარიშის დადასტურება" };

export default async function VerifyPage() {
  const t = await getT();
  const userId = await getPendingUserId();
  if (!userId) redirect("/register");

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/register");
  if (user.emailVerifiedAt && user.phoneVerifiedAt) redirect("/login");

  const mocked = emailIsMocked() || smsIsMocked();

  return (
    <>
      <Header />
      <main className="container-x py-10">
        <div className="mx-auto max-w-xl space-y-4">
          <div>
            <h1 className="text-xl font-bold">{t("ანგარიშის დადასტურება")}</h1>
            <p className="mt-1 text-sm text-muted">
              {t("ორივე კოდი უნდა დაადასტურო — ამის შემდეგ ანგარიში ავტომატურად გაიხსნება.")}
            </p>
          </div>

          {mocked && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {t("სატესტო რეჟიმი: კოდები არსად არ იგზავნება — ისინი სერვერის კონსოლში იბეჭდება.")}
            </p>
          )}

          <VerifyForm channel="EMAIL" target={user.email} done={Boolean(user.emailVerifiedAt)} />
          <VerifyForm channel="SMS" target={`+995 ${user.phone}`} done={Boolean(user.phoneVerifiedAt)} />
        </div>
      </main>
      <Footer />
    </>
  );
}
