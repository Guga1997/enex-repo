/**
 * მიმწოდებლების ავტომატური სინქი — ვისაც ინტერვალი გაუვიდა.
 * სერვერზე systemd timer უშვებს წუთში ერთხელ (deploy/enex-sync.timer).
 * ინტერვალი თითო მიმწოდებელზე ადმინიდან იწერება (/admin/suppliers → „ავტომატური სინქი“).
 */
import { PrismaClient } from "@prisma/client";
import { syncDueSuppliers } from "../src/lib/suppliers/schedule";

const db = new PrismaClient();

syncDueSuppliers()
  .then((runs) => {
    for (const r of runs) {
      const stamp = new Date().toISOString();
      console.log(
        r.result.ok
          ? `${stamp} ${r.name}: +${r.result.created} ახალი, ${r.result.updated} განახლდა${r.result.failed ? `, ${r.result.failed} ჩავარდა` : ""}`
          : `${stamp} ${r.name}: შეცდომა — ${r.result.message}`
      );
    }
  })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
