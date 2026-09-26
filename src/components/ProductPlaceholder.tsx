/**
 * სურათის ნაცვლად — კატეგორიის ხატულა და მოდელი.
 *
 * მიმწოდებლების ნაწილს წვრილ აქსესუარებზე ფოტო არ აქვს („სურათი არ არის“ ცარიელი
 * ადგილი იყო). ხატულა კატეგორიის სახელიდან ირჩევა, ამიტომ ახალ კატეგორიასაც
 * ავტომატურად რაღაც გონივრული ხვდება.
 */

type Props = { category?: string | null; label?: string | null; className?: string };

const ICONS: Record<string, React.ReactNode> = {
  lock: (
    <>
      <rect x="16" y="28" width="32" height="26" rx="4" />
      <path d="M22 28v-8a10 10 0 0 1 20 0v8" />
      <circle cx="32" cy="41" r="3.2" />
    </>
  ),
  plate: (
    <>
      <rect x="22" y="10" width="20" height="44" rx="3" />
      <circle cx="32" cy="20" r="2" />
      <circle cx="32" cy="44" r="2" />
      <path d="M27 30h10" />
    </>
  ),
  card: (
    <>
      <rect x="10" y="18" width="44" height="28" rx="4" />
      <path d="M10 27h44" />
      <path d="M17 37h9" />
      <path d="M40 37h7" />
    </>
  ),
  software: (
    <>
      <rect x="8" y="14" width="48" height="32" rx="3" />
      <path d="M22 54h20M32 46v8" />
      <path d="M22 27l-5 5 5 5M42 27l5 5-5 5" />
    </>
  ),
  safe: (
    <>
      <rect x="9" y="13" width="46" height="38" rx="4" />
      <circle cx="26" cy="32" r="9" />
      <path d="M26 26v3M26 35v3M20 32h3M29 32h3" />
      <path d="M42 24v16" />
    </>
  ),
  minibar: (
    <>
      <rect x="15" y="8" width="34" height="48" rx="4" />
      <path d="M15 26h34" />
      <path d="M42 17v5M42 34v6" />
    </>
  ),
  energy: (
    <>
      <rect x="18" y="8" width="28" height="48" rx="4" />
      <path d="M34 20l-8 13h6l-2 11 8-13h-6z" />
    </>
  ),
  locker: (
    <>
      <rect x="12" y="10" width="40" height="44" rx="3" />
      <path d="M32 10v44" />
      <path d="M25 30h2M39 30h2" />
    </>
  ),
  access: (
    <>
      <rect x="20" y="8" width="24" height="48" rx="4" />
      <circle cx="27" cy="24" r="1.6" /><circle cx="32" cy="24" r="1.6" /><circle cx="37" cy="24" r="1.6" />
      <circle cx="27" cy="31" r="1.6" /><circle cx="32" cy="31" r="1.6" /><circle cx="37" cy="31" r="1.6" />
      <circle cx="27" cy="38" r="1.6" /><circle cx="32" cy="38" r="1.6" /><circle cx="37" cy="38" r="1.6" />
    </>
  ),
  camera: (
    <>
      <path d="M8 22h30l10 6-10 6H8z" />
      <path d="M20 34v10M14 44h12" />
      <circle cx="26" cy="28" r="4" />
    </>
  ),
  network: (
    <>
      <rect x="8" y="24" width="48" height="16" rx="3" />
      <path d="M16 32h4M24 32h4M32 32h4M40 32h4" />
      <path d="M32 24V14M22 14h20" />
    </>
  ),
  cable: (
    <>
      <path d="M14 46c0-12 36-16 36-28" />
      <rect x="8" y="42" width="12" height="9" rx="2" />
      <rect x="44" y="10" width="12" height="9" rx="2" />
    </>
  ),
  power: (
    <>
      <rect x="10" y="20" width="44" height="24" rx="4" />
      <path d="M22 32h8l-3 6 8-8h-8l3-6z" />
      <path d="M46 28v8" />
    </>
  ),
  box: (
    <>
      <path d="M32 8l22 11v26L32 56 10 45V19z" />
      <path d="M10 19l22 11 22-11M32 30v26" />
    </>
  ),
};

/** კატეგორიის სახელი → ხატულა */
function pick(category?: string | null): React.ReactNode {
  const c = (category ?? "").toLowerCase();
  if (/აქსესუარ|ფირფიტ|სამაგრ|მექანიზმ/.test(c)) return ICONS.plate;
  if (/საკეტ|ცილინდრ/.test(c)) return ICONS.lock;
  if (/ბარათ|სამაჯურ/.test(c)) return ICONS.card;
  if (/პროგრამ|software/.test(c)) return ICONS.software;
  if (/სეიფ/.test(c)) return ICONS.safe;
  if (/მინიბარ|მაცივარ/.test(c)) return ICONS.minibar;
  if (/ენერგოსეივ|ენერგო/.test(c)) return ICONS.energy;
  if (/ლოკერ/.test(c)) return ICONS.locker;
  if (/დაშვებ|დომოფონ/.test(c)) return ICONS.access;
  if (/კამერ|ვიდეო|ჩამწერ/.test(c)) return ICONS.camera;
  if (/სვიჩ|როუტერ|wifi|წვდომ|ქსელ|lan|sfp|ოპტიკ/.test(c)) return ICONS.network;
  if (/კაბელ/.test(c)) return ICONS.cable;
  if (/ups|კვებ|აკუმულატორ|ინვერტორ|გენერატორ|პანელ/.test(c)) return ICONS.power;
  return ICONS.box;
}

export default function ProductPlaceholder({ category, label, className = "" }: Props) {
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-canvas ${className}`}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-1/2 max-h-24 text-brand-300"
        aria-hidden
      >
        {pick(category)}
      </svg>
      {label && (
        <span className="max-w-[90%] truncate px-2 text-center font-mono text-[11px] text-muted">{label}</span>
      )}
    </div>
  );
}
