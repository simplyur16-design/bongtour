import { NextResponse } from "next/server";
import sharp from "sharp";
import { isValidCardKey } from "@/lib/home-hub-candidates";
import { isObjectStorageConfigured, uploadStorageObjectRaw } from "@/lib/object-storage";
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

  if (!isObjectStorageConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Ncloud Object Storage가 설정되지 않았습니다. NCLOUD_ACCESS_KEY, NCLOUD_SECRET_KEY, NCLOUD_OBJECT_STORAGE_ENDPOINT, NCLOUD_OBJECT_STORAGE_BUCKET, NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL을 확인하세요.",
      },
      { status: 503 },
    );
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
  const objectKey = `home-hub/${cardKeyRaw}-${ts}.webp`;

  let webpBody: Buffer;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    webpBody = await sharp(buf)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (e) {
    console.error("[admin/upload-image] sharp webp", e);
    return NextResponse.json({ ok: false, error: "이미지 변환에 실패했습니다. 다른 파일로 시도해 주세요." }, { status: 400 });
  }

  try {
    const { publicUrl } = await uploadStorageObjectRaw({
      objectKey,
      body: webpBody,
      contentType: "image/webp",
    });
    return NextResponse.json({ ok: true, path: publicUrl });
  } catch (e) {
    console.error("[admin/upload-image] ncloud upload", e);
    return NextResponse.json({ ok: false, error: "스토리지 업로드에 실패했습니다." }, { status: 500 });
  }
}
