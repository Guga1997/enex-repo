/**
 * განყოფილების ანგარიშის შექმნა ან როლის შეცვლა.
 *
 *   npx tsx scripts/admin-user.ts list
 *   npx tsx scripts/admin-user.ts add sales@enex.ge "გაყიდვები" SALES [პაროლი]
 *   npx tsx scripts/admin-user.ts role sales@enex.ge PURCHASING
 *
 * როლები: ADMIN | SALES | PURCHASING | ACCOUNTING | DELIVERY
 * პაროლის გამოტოვებისას შემთხვევითი გენერირდება და ერთხელ დაიბეჭდება.
 */
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { ROLES, ROLE_LABEL, type Role } from "../src/lib/workflow";

const [cmd, email, name, role, password] = process.argv.slice(2);

(async () => {
  if (cmd === "list") {
    const admins = await db.admin.findMany({ orderBy: { createdAt: "asc" } });
    for (const a of admins) {
      const label = ROLE_LABEL[a.role as Role] ?? a.role;
      console.log(`${a.email.padEnd(28)} ${label.padEnd(18)} ${a.name}`);
    }
    if (!admins.length) console.log("ანგარიში არ არის");
    await db.$disconnect();
    return;
  }

  if (cmd === "add") {
    if (!email || !name || !role) {
      console.log("გამოყენება: add <email> <სახელი> <როლი> [პაროლი]");
      await db.$disconnect();
      return;
    }
    if (!ROLES.includes(role as Role)) {
      console.log(`უცნობი როლი: ${role}. შესაძლებელია: ${ROLES.join(", ")}`);
      await db.$disconnect();
      return;
    }
    const raw = password || randomBytes(9).toString("base64url");
    const admin = await db.admin.upsert({
      where: { email },
      create: { email, name, role, passwordHash: await bcrypt.hash(raw, 10) },
      update: { name, role },
    });
    console.log(`✓ ${admin.email} — ${ROLE_LABEL[admin.role as Role] ?? admin.role}`);
    if (!password) console.log(`  პაროლი: ${raw}   (ერთხელ ჩანს — შეინახე)`);
    await db.$disconnect();
    return;
  }

  if (cmd === "role") {
    if (!ROLES.includes(name as Role)) {
      console.log(`გამოყენება: role <email> <${ROLES.join("|")}>`);
      await db.$disconnect();
      return;
    }
    const admin = await db.admin.update({ where: { email }, data: { role: name } });
    console.log(`✓ ${admin.email} → ${ROLE_LABEL[admin.role as Role]}`);
    await db.$disconnect();
    return;
  }

  console.log("ბრძანებები: list | add | role");
  await db.$disconnect();
})();
