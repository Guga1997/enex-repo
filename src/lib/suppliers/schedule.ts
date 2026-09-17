import { db } from "../db";
import { syncSupplier, type SyncResult } from "./index";

/**
 * გრაფიკით სინქი: ყოველ მიმწოდებელს თავისი ინტერვალი აქვს (`syncEveryMin`),
 * ტაიმერი კი წუთში ერთხელ ამოწმებს, ვის მოუვიდა დრო.
 *
 * ერთდროულად ორი სინქი ერთ მიმწოდებელზე არ უნდა წავიდეს — ამას systemd-ის
 * oneshot სერვისი უზრუნველყოფს: სანამ წინა არ დასრულდება, ახალი არ იწყება.
 */
export async function syncDueSuppliers(now = new Date()): Promise<{ id: string; name: string; result: SyncResult }[]> {
  const candidates = await db.supplier.findMany({
    where: { isActive: true, syncEveryMin: { gt: 0 } },
    select: { id: true, name: true, syncEveryMin: true, lastSyncAt: true },
  });

  const due = candidates.filter(
    (s) => !s.lastSyncAt || now.getTime() - s.lastSyncAt.getTime() >= s.syncEveryMin * 60_000
  );

  // თანმიმდევრულად — ერთი ბაზა, ერთი დისკი, პარალელური ჩამოტვირთვები არ გვჭირდება
  const out = [];
  for (const s of due) {
    out.push({ id: s.id, name: s.name, result: await syncSupplier(s.id) });
  }
  return out;
}
