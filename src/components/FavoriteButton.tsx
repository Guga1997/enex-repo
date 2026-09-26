"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFavoriteAction } from "@/app/actions/customer";

export default function FavoriteButton({
  productId,
  initial,
  signedIn,
}: {
  productId: string;
  initial: boolean;
  signedIn: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle() {
    if (!signedIn) return router.push("/login?next=/account/favorites");

    // ოპტიმისტური გადართვა — სერვერის პასუხს ღილაკი არ ელოდება
    setOn((v) => !v);
    start(async () => {
      const data = new FormData();
      data.set("productId", productId);
      await toggleFavoriteAction(data);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition disabled:opacity-60 ${
        on
          ? "border-brand-200 bg-brand-50 text-brand-600"
          : "border-line bg-surface text-muted hover:bg-canvas"
      }`}
    >
      <span aria-hidden>{on ? "♥" : "♡"}</span>
      {on ? "ფავორიტებშია" : "ფავორიტებში დამატება"}
    </button>
  );
}
