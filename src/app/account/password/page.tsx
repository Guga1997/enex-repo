import PasswordForm from "@/components/PasswordForm";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "პაროლის შეცვლა" };

export default async function PasswordPage() {
  const t = await getT();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t("პაროლის შეცვლა")}</h1>
      <PasswordForm />
    </div>
  );
}
