import PasswordForm from "@/components/PasswordForm";

export const metadata = { title: "პაროლის შეცვლა" };

export default function PasswordPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">პაროლის შეცვლა</h1>
      <PasswordForm />
    </div>
  );
}
