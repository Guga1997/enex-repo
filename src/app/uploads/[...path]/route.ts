import { readFile, stat } from "fs/promises";
import path from "path";

/**
 * /uploads/… — ფაილი პირდაპირ დისკიდან.
 *
 * ბრაუზერს ამ ფაილებს nginx აწვდის. ეს მარშრუტი იმისთვისაა, რომ Next-ის
 * სურათების ოპტიმიზატორი (/_next/image) ფაილს თავისივე სერვერიდან ითხოვს, Next
 * კი public/-ში მხოლოდ გაშვებისას არსებულ ფაილებს ხედავს. სინქით ჩამოტვირთული ან
 * ადმინიდან ატვირთული ფოტო მომდევნო გადატვირთვამდე „არავალიდურ სურათად“ ჩანდა.
 */

const ROOT = path.join(process.cwd(), "public", "uploads");

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

/** ფაილის თავი — გაფართოება ყოველთვის არ ემთხვევა (ზოგი მიმწოდებელი PNG-ს .jpg-ით აგზავნის) */
function sniff(buf: Buffer): string | null {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(0, 3).toString() === "GIF") return "image/gif";
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path ?? [];
  const file = path.join(ROOT, ...parts.map((p) => decodeURIComponent(p)));
  // ../-ით ფესვიდან გასვლა არ შეიძლება
  if (!file.startsWith(ROOT + path.sep)) return new Response("Not found", { status: 404 });

  try {
    if (!(await stat(file)).isFile()) throw new Error("not a file");
    const buf = await readFile(file);
    const ext = path.extname(file).toLowerCase();
    const type = sniff(buf) ?? TYPES[ext] ?? "application/octet-stream";
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        // სახელი შიგთავსის ჰეშია — ფაილი არ იცვლება
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
