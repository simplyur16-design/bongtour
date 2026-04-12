import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { PRIVATE_TRIP_HERO_UPLOAD_MAX_BYTES } from '@/lib/private-trip-hero-constants'
import { processPrivateTripHeroImageToWebpCover, saveProcessedPrivateTripHeroWebp } from '@/lib/private-trip-hero-upload'

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
])

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ ok: false, error: 'file 필드에 이미지가 필요합니다.' }, { status: 400 })
    }
    if (file.size > PRIVATE_TRIP_HERO_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: `파일은 ${Math.round(PRIVATE_TRIP_HERO_UPLOAD_MAX_BYTES / 1024 / 1024)}MB 이하여야 합니다.` },
        { status: 400 },
      )
    }
    const mime = (file.type || '').toLowerCase().split(';')[0]!.trim()
    if (mime && !ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { ok: false, error: 'jpg, png, webp, gif, avif, heic 등 이미지 형식만 업로드할 수 있습니다.' },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let webp: Buffer
    try {
      webp = await processPrivateTripHeroImageToWebpCover(buffer)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[private-trip-hero-folder/upload] sharp', e)
      return NextResponse.json(
        { ok: false, error: '이미지 처리에 실패했습니다. 다른 파일로 시도하거나 JPG/PNG로 변환해 주세요.', detail: msg },
        { status: 400 },
      )
    }

    const saved = await saveProcessedPrivateTripHeroWebp(webp, file.name || 'upload')

    return NextResponse.json({
      ok: true,
      fileName: saved.fileName,
      publicUrl: saved.publicUrl,
      bytesWritten: saved.bytesWritten,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '저장 실패'
    console.error('[private-trip-hero-folder/upload]', e)
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }
}
