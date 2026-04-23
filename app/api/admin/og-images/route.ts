import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { convertToWebp } from '@/lib/image-to-webp'
import {
  deletePreviousOgStorageIfAny,
  getAllOgImages,
  isValidOgPageKey,
  upsertOgImage,
  type OgPageKey,
} from '@/lib/og-images-db'
import { requireAdmin } from '@/lib/require-admin'
import { isObjectStorageConfigured, uploadStorageObject } from '@/lib/object-storage'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])

function buildPageOgObjectKey(pageKey: string): string {
  const safe = pageKey.replace(/[^a-z0-9-]/gi, '_')
  return `page-og/${safe}.webp`
}

const OG_REVALIDATE_PATHS: Record<OgPageKey, string[]> = {
  default: ['/'],
  overseas: ['/travel/overseas'],
  'private-trip': ['/travel/overseas/private-trip'],
  domestic: ['/travel/domestic'],
  training: ['/training'],
  esim: ['/travel/esim'],
}

function revalidateOgPathsForPageKey(pageKey: OgPageKey): void {
  const paths = OG_REVALIDATE_PATHS[pageKey] ?? []
  for (const path of paths) {
    try {
      revalidatePath(path)
    } catch (e) {
      console.error('[og-images revalidate]', path, e)
    }
  }
}

/**
 * GET /api/admin/og-images — 전체 페이지 키별 OG 메타(없으면 null)
 * POST /api/admin/og-images — FormData: file, pageKey → Supabase 업로드 + upsert
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const items = await getAllOgImages()
    return NextResponse.json({ ok: true, items })
  } catch (e) {
    console.error('[og-images GET]', e)
    return NextResponse.json(
      { ok: false, error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })

  if (!isObjectStorageConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Supabase Storage가 설정되지 않았습니다.' },
      { status: 503 }
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'FormData 파싱 실패' }, { status: 400 })
  }

  const pageKeyRaw = String(form.get('pageKey') ?? '').trim()
  if (!isValidOgPageKey(pageKeyRaw)) {
    return NextResponse.json({ ok: false, error: '유효하지 않은 pageKey 입니다.' }, { status: 400 })
  }
  const pageKey = pageKeyRaw as OgPageKey

  const file = form.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: 'file 이 필요합니다.' }, { status: 400 })
  }

  const mime = (file.type || '').split(';')[0]?.trim().toLowerCase() || ''
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { ok: false, error: 'PNG, JPEG, WebP 이미지만 업로드할 수 있습니다.' },
      { status: 400 }
    )
  }

  const buf = Buffer.from(await file.arrayBuffer())
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: '파일 크기는 5MB 이하여야 합니다.' }, { status: 400 })
  }

  let webp: Buffer
  let width: number
  let height: number
  try {
    const converted = await convertToWebp(buf, { maxWidth: 2400, quality: 82 })
    webp = converted.buffer
    width = converted.width
    height = converted.height
  } catch (e) {
    console.error('[og-images POST] webp', e)
    return NextResponse.json({ ok: false, error: '이미지 변환에 실패했습니다.' }, { status: 400 })
  }

  const objectKey = buildPageOgObjectKey(pageKey)

  try {
    await deletePreviousOgStorageIfAny(pageKey)
  } catch (e) {
    console.warn('[og-images POST] delete previous', e)
  }

  let publicUrl: string
  try {
    const up = await uploadStorageObject({
      objectKey,
      body: webp,
      contentType: 'image/webp',
    })
    publicUrl = up.publicUrl
  } catch (e) {
    console.error('[og-images POST] upload', e)
    const msg = e instanceof Error ? e.message : '업로드 실패'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }

  const uploadedBy = (admin.user as { id?: string })?.id ?? null

  try {
    const row = await upsertOgImage({
      pageKey,
      imageUrl: publicUrl,
      storagePath: objectKey,
      width,
      height,
      fileSize: webp.length,
      uploadedBy,
    })
    revalidateOgPathsForPageKey(pageKey)
    return NextResponse.json({ ok: true, asset: row })
  } catch (e) {
    console.error('[og-images POST] db', e)
    return NextResponse.json(
      { ok: false, error: 'DB 저장에 실패했습니다. Storage에 파일은 올라갔을 수 있습니다.' },
      { status: 500 }
    )
  }
}
