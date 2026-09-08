/**
 * ელფოსტა. პროვაიდერი ჯერ არჩეული არ არის, ამიტომ ინტერფეისი ერთია და
 * იმპლემენტაცია ორი: Resend (თუ გასაღები დევს) და mock (კონსოლში წერს).
 * გასაღების ჩასმა საკმარისია — კოდი აღარ იცვლება.
 */
export type Attachment = { filename: string; content: string; contentType?: string };

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
};

const FROM = process.env.MAIL_FROM || "shop@example.ge";

export const emailIsMocked = () => !process.env.RESEND_API_KEY;

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (emailIsMocked()) {
    console.log(
      `\n[MOCK EMAIL] → ${msg.to}\n  თემა: ${msg.subject}\n` +
        (msg.attachments?.length ? `  დანართი: ${msg.attachments.map((a) => a.filename).join(", ")}\n` : "") +
        `  ${(msg.text ?? msg.html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 300)}\n`
    );
    return { ok: true, id: "mock" };
  }

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
      attachments: msg.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    }),
  });

  if (!res.ok) return { ok: false, error: `${res.status} ${await res.text()}` };
  const json = (await res.json()) as { id?: string };
  return { ok: true, id: json.id };
}
