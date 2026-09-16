/**
 * SMS-ის შემოწმება: npx tsx scripts/test-sms.ts 5XXXXXXXX
 */
import { sendSms, smsProvider } from "../src/lib/notify/sms";

async function main() {
  const to = process.argv[2];
  console.log("პროვაიდერი: " + smsProvider());
  if (!to) return console.log("ნომერი მიუთითე: npx tsx scripts/test-sms.ts 5XXXXXXXX");
  const r = await sendSms(to, "Enex: სატესტო SMS. თუ ამას კითხულობ, გაგზავნა მუშაობს.");
  console.log(r.ok ? "✓ გაიგზავნა" + (r.id ? " (" + r.id + ")" : "") : "✗ " + r.error);
  if (!r.ok) process.exit(1);
}
main();
