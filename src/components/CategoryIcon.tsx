/**
 * სეგმენტის ხატულა ნავიგაციის ზოლისთვის — სახელით ან slug-ით ირჩევა,
 * რომ ახალ სეგმენტსაც ავტომატურად მოხვდეს რაღაც გონივრული.
 */

type Props = { name: string; slug?: string; className?: string };

const ICONS: Record<string, React.ReactNode> = {
  power: (
    <>
      <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.5 4.5 5.5v6c0 4.7 3.1 8.6 7.5 10 4.4-1.4 7.5-5.3 7.5-10v-6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  network: (
    <>
      <rect x="2.5" y="13.5" width="19" height="7" rx="2" />
      <path d="M6 17h1.5M10 17h1.5M14 17h1.5" />
      <path d="M12 13.5v-5M7.5 8.5h9" />
      <path d="M8.5 5.5a5 5 0 0 1 7 0" />
    </>
  ),
  fiber: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="4" cy="5" r="1.8" />
      <circle cx="20" cy="5" r="1.8" />
      <circle cx="4" cy="19" r="1.8" />
      <circle cx="20" cy="19" r="1.8" />
      <path d="m5.4 6.3 4.9 4.2M18.6 6.3l-4.9 4.2M5.4 17.7l4.9-4.2M18.6 17.7l-4.9-4.2" />
    </>
  ),
  hotel: (
    <>
      <path d="M3 18v-8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2V18" />
      <path d="M3 14.5h18M3 18v2M21 18v2" />
      <path d="M7 7.5v-2a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 17 5.5v2" />
    </>
  ),
  av: (
    <>
      <rect x="2.5" y="4.5" width="19" height="13" rx="2" />
      <path d="M8 21h8M12 17.5V21" />
      <path d="m10.5 9 4 2.5-4 2.5z" />
    </>
  ),
  storage: (
    <>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" />
      <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </>
  ),
  box: (
    <>
      <path d="M12 2.5 21 7v10l-9 4.5L3 17V7z" />
      <path d="M3 7l9 4.5L21 7M12 11.5V21" />
    </>
  ),
};

function pick(name: string, slug = ""): React.ReactNode {
  const s = `${name} ${slug}`.toLowerCase();
  if (/ენერგო|კვება|generator|energo/.test(s)) return ICONS.power;
  if (/უსაფრთხო|დაცვ|კამერ|security/.test(s)) return ICONS.shield;
  if (/ოპტიკ|optik|ბოჭკ/.test(s)) return ICONS.fiber;
  if (/lan|wan|ქსელ|სვიჩ|როუტერ/.test(s)) return ICONS.network;
  if (/სასტუმრო|sastumro|hotel/.test(s)) return ICONS.hotel;
  if (/აუდიო|ვიდეო|audio|video/.test(s)) return ICONS.av;
  if (/მონაცემ|შენახვ|სერვერ|დისკ|storage/.test(s)) return ICONS.storage;
  return ICONS.box;
}

export default function CategoryIcon({ name, slug, className = "" }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {pick(name, slug)}
    </svg>
  );
}
