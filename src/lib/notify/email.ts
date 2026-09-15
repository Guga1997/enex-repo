import nodemailer, { type Transporter } from "nodemailer";

/**
 * ელფოსტა — სამი გზა, პრიორიტეტით:
 *   1. SMTP  (SMTP_HOST არის)        — Brevo, Zoho, ნებისმიერი SMTP რელე
 *   2. Resend (RESEND_API_KEY არის)  — HTTP API
 *   3. mock                          — კონსოლში იბეჭდება
 *
 * ინტერფეისი ერთია; პროვაიდერის შეცვლა მხოლოდ .env-ს ეხება.
 */
export type Attachment = { filename: string; content: string; contentType?: string };

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
};

export type SendResult = { ok: boolean; id?: string; error?: string };

const FROM = process.env.MAIL_FROM || "shop@example.ge";

export const emailTransport = (): "smtp" | "resend" | "mock" =>
  process.env.SMTP_HOST ? "smtp" : process.env.RESEND_API_KEY ? "resend" : "mock";

export const emailIsMocked = () => emailTransport() === "mock";

/* ────────────────────────────── SMTP ────────────────────────────── */

let smtp: Transporter | null = null;

/** ერთი კავშირი მთელი პროცესისთვის — ყოველ წერილზე ხელახლა არ ვუკავშირდებით */
function smtpTransport(): Transporter {
  if (smtp) return smtp;
  const port = Number(process.env.SMTP_PORT || 587);
  smtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 — TLS თავიდანვე; 587 — STARTTLS
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
      : undefined,
    pool: true,
    maxConnections: 3,
  });
  return smtp;
}

async function sendViaSmtp(msg: EmailMessage): Promise<SendResult> {
  try {
    const info = await smtpTransport().sendMail({
      from: FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      attachments: msg.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return { ok: true, id: info.messageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ───────────────────────────── Resend ───────────────────────────── */

async function sendViaResend(msg: EmailMessage): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    }),
  });
  if (!res.ok) return { ok: false, error: `${res.status} ${await res.text()}` };
  const json = (await res.json()) as { id?: string };
  return { ok: true, id: json.id };
}

/* ────────────────────────────── mock ────────────────────────────── */

function sendViaMock(msg: EmailMessage): SendResult {
  console.log(
    `\n[MOCK EMAIL] → ${msg.to}\n  თემა: ${msg.subject}\n` +
      (msg.attachments?.length ? `  დანართი: ${msg.attachments.map((a) => a.filename).join(", ")}\n` : "") +
      `  ${(msg.text ?? msg.html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 300)}\n`
  );
  return { ok: true, id: "mock" };
}

/* ─────────────────────────────────────────────────────────────────── */

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  switch (emailTransport()) {
    case "smtp":
      return sendViaSmtp(msg);
    case "resend":
      return sendViaResend(msg);
    default:
      return sendViaMock(msg);
  }
}

/** კავშირის შემოწმება წერილის გაგზავნის გარეშე — ადმინიდან ან სკრიპტიდან */
export async function verifyEmailTransport(): Promise<SendResult> {
  const t = emailTransport();
  if (t === "mock") return { ok: true, id: "mock — გასაღები არ არის, კონსოლში იბეჭდება" };
  if (t === "resend") return { ok: true, id: "resend — გასაღები დაყენებულია" };
  try {
    await smtpTransport().verify();
    return { ok: true, id: `smtp — ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587} პასუხობს` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
