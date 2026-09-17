import Image from "next/image";
import { db } from "@/lib/db";
import ImageUploader from "@/components/admin/ImageUploader";
import { deleteBanner, saveBanner } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "ბანერები" };

const field =
  "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500";

/** მთავარი გვერდის სლაიდერი — სურათი, წარწერა და სად გადაიყვანოს დაკლიკებამ */
export default async function BannersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const [banners, brands, roots] = await Promise.all([
    db.banner.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    db.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" }, select: { slug: true, nameKa: true } }),
  ]);
  const editing = edit ? banners.find((b) => b.id === edit) ?? null : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">ბანერები</h1>
        <p className="mt-1 text-sm text-muted">
          მთავარი გვერდის სლაიდერი. თითო სლაიდი — სურათი და ბმული: ბრენდის მოდელებზე,
          სეგმენტზე, კონკრეტულ პროდუქტზე. ბანერების გარეშე ძველი ლურჯი ბლოკი ჩანს.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="p-3 font-medium">სურათი</th>
              <th className="p-3 font-medium">სათაური</th>
              <th className="p-3 font-medium">ბმული</th>
              <th className="p-3 font-medium">რიგი</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {banners.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted">ბანერი ჯერ არ არის.</td>
              </tr>
            )}
            {banners.map((b) => (
              <tr key={b.id} className={b.isActive ? "" : "opacity-50"}>
                <td className="p-3">
                  <div className="relative h-14 w-28 overflow-hidden rounded-md bg-canvas">
                    <Image src={b.image} alt="" fill className="object-cover" sizes="112px" />
                  </div>
                </td>
                <td className="p-3">
                  <div className="font-medium">{b.title}</div>
                  {b.subtitle && <div className="text-xs text-muted">{b.subtitle}</div>}
                </td>
                <td className="p-3 font-mono text-xs">{b.href}</td>
                <td className="p-3">{b.sortOrder}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1.5">
                    <a
                      href={`/admin/banners?edit=${b.id}`}
                      className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-canvas"
                    >
                      რედაქტირება
                    </a>
                    <form action={deleteBanner}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                        წაშლა
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={saveBanner} className="card space-y-4 p-5" key={editing?.id ?? "new"}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">{editing ? `რედაქტირება — ${editing.title}` : "ახალი ბანერი"}</h2>
          {editing && (
            <a href="/admin/banners" className="text-xs text-muted hover:underline">გაუქმება</a>
          )}
        </div>
        {editing && <input type="hidden" name="id" value={editing.id} />}

        <div>
          <span className="mb-1.5 block text-sm font-medium">სურათი</span>
          <ImageUploader name="image" initial={editing ? [editing.image] : []} />
          <span className="mt-1 block text-xs text-muted">
            რეკომენდებული 1600×500 პიქსელი ან ფართო ფოტო — ტექსტი მარცხენა მხარეს დაედება, სურათის მარჯვენა ნაწილი უნდა იყოს „სუფთა“.
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">სათაური</span>
            <input name="title" required defaultValue={editing?.title} placeholder="Bluetti — ენერგია ყველგან" className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">ქვესათაური</span>
            <input name="subtitle" defaultValue={editing?.subtitle ?? ""} placeholder="პორტატული ელსადგურები 300W-დან 6000W-მდე" className={field} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">დაკლიკებაზე გადაიყვანოს</span>
          <input name="href" required list="banner-hrefs" defaultValue={editing?.href ?? ""} placeholder="/catalog?brand=bluetti" className={`${field} font-mono`} />
          <datalist id="banner-hrefs">
            {brands.map((b) => (
              <option key={b.slug} value={`/catalog?brand=${b.slug}`}>{b.name} — ბრენდის ყველა მოდელი</option>
            ))}
            {roots.map((c) => (
              <option key={c.slug} value={`/catalog/${c.slug}`}>{c.nameKa} — სეგმენტი</option>
            ))}
          </datalist>
          <span className="mt-1 block text-xs text-muted">
            ბრენდი: <code>/catalog?brand=სლაგი</code> · სეგმენტი: <code>/catalog/სლაგი</code> · პროდუქტი: <code>/product/სლაგი</code>. ველში წერისას სია გამოდის.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">რიგი</span>
            <input name="sortOrder" type="number" defaultValue={editing?.sortOrder ?? banners.length} className={field} />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} className="size-4 accent-brand-500" />
            აქტიურია
          </label>
        </div>

        <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          შენახვა
        </button>
      </form>
    </div>
  );
}
