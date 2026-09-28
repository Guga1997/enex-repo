import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { authenticateApiKey } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const MAX = 8 * 1024 * 1024;
const EXT = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
]);

/**
 * POST /api/v1/uploads — სურათის ატვირთვა API გასაღებით.
 *
 * საწყობის აპლიკაციას ტელეფონის კამერიდან ატვირთვა სჭირდება, ადმინის სესია კი
 * მას არ აქვს. ორივე ფორმა მუშაობს: multipart (`file`) და JSON base64
 * (`{data:"data:image/jpeg;base64,…"}`).
 */
export async function POST(req: Request) {
  const auth = await authenticateApiKey(req, "stock:write");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let buf: Buffer;
  let type: string;

  const ctype = req.headers.get("content-type") ?? "";
  if (ctype.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { data?: string } | null;
    const m = body?.data?.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return NextResponse.json({ error: "data ველი base64 სურათი უნდა იყოს" }, { status: 400 });
    type = m[1];
    buf = Buffer.from(m[2], "base64");
  } else {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "ფაილი არ არის" }, { status: 400 });
    type = file.type;
    buf = Buffer.from(await file.arrayBuffer());
  }

  const ext = EXT.get(type);
  if (!ext) return NextResponse.json({ error: `დაუშვებელი ფორმატი: ${type || "უცნობი"}` }, { status: 400 });
  if (buf.length > MAX) return NextResponse.json({ error: "მაქსიმუმ 8MB" }, { status: 400 });

  const dir = path.join(process.cwd(), "public", "uploads", "products", "pc");
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}${ext}`;
  await writeFile(path.join(dir, name), buf);

  return NextResponse.json({ url: `/uploads/products/pc/${name}`, size: buf.length });
}
