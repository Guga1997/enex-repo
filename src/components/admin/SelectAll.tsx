"use client";

/** სათაურის ჩექბოქსი — გვერდზე ყველა ხაზს ერთდროულად ნიშნავს ან ხსნის */
export default function SelectAll({ form }: { form: string }) {
  return (
    <input
      type="checkbox"
      aria-label="ყველას მონიშვნა"
      className="size-4 accent-brand-500"
      onChange={(e) => {
        const boxes = document.querySelectorAll<HTMLInputElement>(
          `form#${form} input[type="checkbox"][name="ids"]`
        );
        boxes.forEach((b) => { b.checked = e.currentTarget.checked; });
      }}
    />
  );
}
