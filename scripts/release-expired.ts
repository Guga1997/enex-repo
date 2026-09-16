/**
 * ვადაგასული რეზერვაციების გათავისუფლება.
 * სერვერზე systemd timer უშვებს წუთში ერთხელ (deploy/enex-release.timer).
 */
import { PrismaClient } from "@prisma/client";
import { releaseExpiredReservations } from "../src/lib/orders";

const db = new PrismaClient();

releaseExpiredReservations()
  .then((n) => { if (n > 0) console.log(`${new Date().toISOString()} გათავისუფლდა: ${n} შეკვეთა`); })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
