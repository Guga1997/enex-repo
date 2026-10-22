/**
 * პაროლის აღდგენა — კოდი ერთჯერადია, ვადიანი და ცდებშეზღუდული.
 * რეგისტრაციის დადასტურებას არ ერევა: ცალკე არხია.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { findUserByLogin, issueResetCode, resetPassword } from "../src/lib/customer-auth";

const EMAIL = "reset-test@example.test";
const PHONE = "599000777"; // ბაზაში ლოკალური ფორმით ინახება
let userId = "";

/** უკანასკნელი გაცემული კოდი ბაზიდან ვერ იკითხება (დაჰეშილია) — ვცვლით ჩვენით */
async function plantCode(code: string, opts: { expired?: boolean; attempts?: number } = {}) {
  await db.verificationCode.updateMany({
    where: { userId, channel: "RESET", consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await db.verificationCode.create({
    data: {
      userId,
      channel: "RESET",
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + (opts.expired ? -60_000 : 600_000)),
      attempts: opts.attempts ?? 0,
    },
  });
}

test("სატესტო ანგარიში", async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  const u = await db.user.create({
    data: {
      email: EMAIL,
      phone: PHONE,
      passwordHash: await bcrypt.hash("oldpassword", 10),
      type: "INDIVIDUAL",
      name: "ტესტი",
      taxId: "00000000000",
      address: "თბილისი",
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
    },
  });
  userId = u.id;
  assert.ok(userId);
});

test("ანგარიში ელფოსტითაც იძებნება და ნომრითაც", async () => {
  assert.equal((await findUserByLogin(EMAIL))?.id, userId);
  assert.equal((await findUserByLogin(EMAIL.toUpperCase()))?.id, userId, "რეგისტრი არ უნდა შლიდეს");
  assert.equal((await findUserByLogin("599 00 07 77"))?.id, userId, "ნომრის ფორმატი ნორმალიზდება");
  assert.equal(await findUserByLogin("არავინ@example.test"), null);
});

test("სწორი კოდი პაროლს ცვლის", async () => {
  await plantCode("111111");
  const r = await resetPassword(userId, "111111", "newpassword1");
  assert.equal(r.ok, true);
  const u = await db.user.findUnique({ where: { id: userId } });
  assert.ok(await bcrypt.compare("newpassword1", u!.passwordHash), "ახალი პაროლი არ ჩაიწერა");
  assert.equal(await bcrypt.compare("oldpassword", u!.passwordHash), false, "ძველი ისევ მუშაობს");
});

test("კოდი ერთჯერადია", async () => {
  await plantCode("222222");
  assert.equal((await resetPassword(userId, "222222", "second-pass-1")).ok, true);
  const again = await resetPassword(userId, "222222", "third-pass-11");
  assert.equal(again.ok, false, "იგივე კოდი მეორედ გავიდა");
});

test("ვადაგასული კოდი არ მუშაობს", async () => {
  await plantCode("333333", { expired: true });
  const r = await resetPassword(userId, "333333", "whatever-pass");
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.error, /ვადა/);
});

test("არასწორი კოდი ცდას ითვლის და ლიმიტზე ჩერდება", async () => {
  await plantCode("444444");
  const bad = await resetPassword(userId, "000000", "whatever-pass");
  assert.equal(bad.ok, false);
  const row = await db.verificationCode.findFirst({
    where: { userId, channel: "RESET", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(row?.attempts, 1, "ცდა არ ჩაითვალა");

  await plantCode("444444", { attempts: 5 });
  const locked = await resetPassword(userId, "444444", "whatever-pass");
  assert.equal(locked.ok, false, "ლიმიტის მიღმა სწორმა კოდმაც გაიარა");
  assert.match(locked.ok ? "" : locked.error, /ლიმიტი/);
});

test("აღდგენის კოდი რეგისტრაციის დადასტურებას არ ერევა", async () => {
  await issueResetCode(userId);
  const reset = await db.verificationCode.count({ where: { userId, channel: "RESET", consumedAt: null } });
  const email = await db.verificationCode.count({ where: { userId, channel: "EMAIL", consumedAt: null } });
  assert.equal(reset, 1);
  assert.equal(email, 0, "EMAIL არხი არ უნდა შეხებოდა");
});

after(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  await db.$disconnect();
});
