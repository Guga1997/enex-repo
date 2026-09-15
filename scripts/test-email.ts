/**
 * ელფოსტის კავშირის შემოწმება და სატესტო წერილი.
 *   npx tsx scripts/test-email.ts                 # მხოლოდ კავშირი
 *   npx tsx scripts/test-email.ts someone@x.ge    # კავშირი + წერილი
 */
import { sendEmail, verifyEmailTransport, emailTransport } from "../src/lib/notify/email";

async function main() {
  console.log("ტრანსპორტი: " + emailTransport());
  const v = await verifyEmailTransport();
  console.log(v.ok ? "✓ " + v.id : "✗ " + v.error);
  if (!v.ok) process.exit(1);

  const to = process.argv[2];
  if (!to) return;

  const r = await sendEmail({
    to,
    subject: "Enex — სატესტო წერილი",
    html: "<p>ეს სატესტო წერილია enex.ge-დან. თუ ამას კითხულობ, SMTP მუშაობს.</p>",
    text: "ეს სატესტო წერილია enex.ge-დან. თუ ამას კითხულობ, SMTP მუშაობს.",
  });
  console.log(r.ok ? "✓ გაიგზავნა: " + r.id : "✗ ვერ გაიგზავნა: " + r.error);
  if (!r.ok) process.exit(1);
}

main();
