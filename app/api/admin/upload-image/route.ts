import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { isValidCardKey } from "@/lib/home-hub-candidates";
import { requireAdmin } from "@/lib/require-admin";

const MAX_BYTES = 12 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function extFromFilename(name: string): string | null {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name.trim());
  if (!m) return null;
  const e = m[1]!.toLowerCase();
  if (e === "jpeg" || e === "jpg") return "jpg";
  if (["png", "webp", "gif", "avif"].includes(e)) return e;
  return null;
}

function pickExt(file: File): string | null {
  const mime = (file.type || "").toLowerCase().split(";")[0]!.trim();
  if (mime && MIME_TO_EXT[mime]) return MIME_TO_EXT[mime]!;
  return extFromFilename(file.name || "");
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "FormData가 아닙니다." }, { status: 400 });
  }

  const file = form.get("file");
  const cardKeyRaw = typeof form.get("cardKey") === "string" ? (form.get("cardKey") as string).trim() : "";

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "file 필드에 이미지가 필요합니다." }, { status: 400 });
  }

  if (!isValidCardKey(cardKeyRaw)) {
    return NextResponse.json({ ok: false, error: "cardKey는 overseas|training|domestic|esim 중 하나여야 합니다." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: `파일은 ${Math.round(MAX_BYTES / 1024 / 1024)}MB 이하여야 합니다.` },
      { status: 400 },
    );
  }

  const ext = pickExt(file);
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: "jpg, png, webp, gif, avif 이미지만 업로드할 수 있습니다." },
      { status: 400 },
    );
  }

  const ts = Date.now();
  const filename = `${cardKeyRaw}-${ts}.${ext}`;
  const dir = path.join(process.cwd(), "public", "images", "home-hub");
  const fullPath = path.join(dir, filename);

  try {
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buf);
  } catch (e) {
    console.error("[admin/upload-image] write", e);
    return NextResponse.json({ ok: false, error: "파일 저장에 실패했습니다." }, { status: 500 });
  }

  const publicPath = `/images/home-hub/${filename}`;
  return NextResponse.json({ ok: true, path: publicPath });
}
