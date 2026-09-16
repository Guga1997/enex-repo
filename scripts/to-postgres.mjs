/**
 * schema.prisma → PostgreSQL ვარიანტი და საწყისი მიგრაციის SQL.
 *
 * ორ სქემას განზრახ არ ვინახავთ — ისინი აუცილებლად დაშორდებოდნენ ერთმანეთს.
 * წყარო ერთია, პროდაქშენის ვარიანტი ყოველ ჯერზე თავიდან გენერირდება.
 *
 *   node scripts/to-postgres.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { execFileSync } from "child_process";

const SRC = "prisma/schema.prisma";
const OUT = "prisma/schema.postgres.prisma";
const MIGRATION_DIR = "prisma/migrations/0_init";

const src = readFileSync(SRC, "utf8");
if (!src.includes('provider = "sqlite"')) {
  console.error("წყარო sqlite-ზე არ არის — გადაამოწმე " + SRC);
  process.exit(1);
}

writeFileSync(
  OUT,
  "// გენერირებულია scripts/to-postgres.mjs-ით — ხელით არ შეასწორო.\n" +
    "// წყარო: prisma/schema.prisma\n" +
    src.replace('provider = "sqlite"', 'provider = "postgresql"')
);
console.log("✓ " + OUT);

// 0_init მხოლოდ ერთხელ იქმნება — გამოყენებული მიგრაციის შეცვლა prisma-ს checksum-ს ტეხავს.
// შემდგომი ცვლილებები ცალკე საქაღალდეებში იწერება: prisma/migrations/N_სახელი/migration.sql
if (existsSync(`${MIGRATION_DIR}/migration.sql`)) {
  console.log("• " + MIGRATION_DIR + " უკვე არსებობს — უცვლელი რჩება");
  process.exit(0);
}
mkdirSync(MIGRATION_DIR, { recursive: true });
// prisma-ს CLI-ს პირდაპირ node-ით ვიძახებთ — .cmd-ის გარშემო shell არ გვჭირდება
const sql = execFileSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate", "diff", "--from-empty", "--to-schema-datamodel", OUT, "--script",
  ],
  { encoding: "utf8" }
);
writeFileSync(`${MIGRATION_DIR}/migration.sql`, sql);

const tables = (sql.match(/CREATE TABLE/g) ?? []).length;
const indexes = (sql.match(/CREATE (UNIQUE )?INDEX/g) ?? []).length;
console.log(`✓ ${MIGRATION_DIR}/migration.sql — ცხრილი ${tables}, ინდექსი ${indexes}`);
