import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOC_BYTES = 20 * 1024 * 1024; // datasheet ხშირად რამდენიმე მეგაბაიტია

const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
  ["application/pdf", ".pdf"],
  ["application/msword", ".doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["application/vnd.ms-excel", ".xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
]);

const isImage = (type: string) => type.startsWith("image/");

/**
 * სურათის ატვირთვა public/uploads-ში.
 *
 * ეს საკმარისია ერთი სერვერისთვის. Vercel-ზე ან რამდენიმე ინსტანსზე
 * გაშვებისას ფაილური სისტემა არ არის მუდმივი — ჩაანაცვლე S3 / Cloudflare R2
 * / UploadThing-ით (მხოლოდ ეს ფაილი შეიცვლება).
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "არაავტორიზებული" }, { status: 401 });

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "ფაილი არ არის" }, { status: 400 });

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });

  const uploaded: { url: string; name: string; size: number }[] = [];
  for (const file of files) {
    const ext = ALLOWED.get(file.type);
    if (!ext) {
      return NextResponse.json(
        {
          error: `დაუშვებელი ფორმატი: ${file.type || "უცნობი"}. დაშვებულია JPG, PNG, WebP, AVIF, PDF, DOC(X), XLS(X)`,
        },
        { status: 400 }
      );
    }

    const limit = isImage(file.type) ? MAX_IMAGE_BYTES : MAX_DOC_BYTES;
    if (file.size > limit) {
      return NextResponse.json(
        { error: `${file.name} — მაქსიმუმ ${Math.round(limit / 1024 / 1024)}MB` },
        { status: 400 }
      );
    }

    const name = `${randomUUID()}${ext}`;
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    uploaded.push({ url: `/uploads/${name}`, name: file.name, size: file.size });
  }

  // urls — ძველი ველი, სურათების ატვირთვა მას იყენებს
  return NextResponse.json({ urls: uploaded.map((u) => u.url), files: uploaded });
}
