import { db } from "../db";
import { syncSupplier, type SyncResult } from "./index";

/**
 * გრაფიკით სინქი: ყოველ მიმწოდებელს თავისი ინტერვალი აქვს (`syncEveryMin`),
 * ტაიმერი კი წუთში ერთხელ ამოწმებს, ვის მოუვიდა დრო.
 *
 * ერთდროულად ორი სინქი ერთ მიმწოდებელზე არ უნდა წავიდეს: ტაიმერის გაშვებებს systemd-ის
 * oneshot სერვისი ყოფს, ადმინიდან ხელით გაშვებულს — syncSupplier-ის „უკვე მიმდინარეობს“ შემოწმება.
 */
export async function syncDueSuppliers(now = new Date()): Promise<{ id: string; name: string; result: SyncResult }[]> {
  const candidates = await db.supplier.findMany({
    where: { isActive: true, syncEveryMin: { gt: 0 } },
    select: { id: true, name: true, syncEveryMin: true, lastSyncAt: true },
  });

  // ყველაზე დიდი ხნის წინ დასინქრონებული პირველი — გაჭედილი მიმწოდებელი სხვებს რიგში არ ჩამოიტოვებს
  const due = candidates
    .filter((s) => !s.lastSyncAt || now.getTime() - s.lastSyncAt.getTime() >= s.syncEveryMin * 60_000)
    .sort((a, b) => (a.lastSyncAt?.getTime() ?? 0) - (b.lastSyncAt?.getTime() ?? 0));

  // თანმიმდევრულად — ერთი ბაზა, ერთი დისკი, პარალელური ჩამოტვირთვები არ გვჭირდება
  const out = [];
  for (const s of due) {
    out.push({ id: s.id, name: s.name, result: await syncSupplier(s.id) });
  }
  return out;
}
