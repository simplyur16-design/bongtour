import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import {
  isPrivateTripHeroDirectBrowserUploadConfigured,
  signPrivateTripHeroIncomingUpload,
} from '@/lib/private-trip-hero-direct-upload-server'

/**
 * 브라우저가 원본을 Ncloud Object Storage로 직접 PUT하기 위한 presigned URL 발급(nginx 본문 한도 회피).
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }
  if (!isPrivateTripHeroDirectBrowserUploadConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          '직접 업로드: NCLOUD_ACCESS_KEY, NCLOUD_SECRET_KEY, NCLOUD_OBJECT_STORAGE_ENDPOINT, NCLOUD_OBJECT_STORAGE_BUCKET, NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL이 서버에 필요합니다.',
      },
      { status: 400 },
    )
  }

  try {
    const body = (await request.json()) as { byteLength?: number; mimeType?: string }
    const byteLength = typeof body.byteLength === 'number' ? body.byteLength : Number(body.byteLength)
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''
    const { incomingPath, uploadUrl, contentType } = await signPrivateTripHeroIncomingUpload({ byteLength, mimeType })
    return NextResponse.json({
      ok: true,
      incomingPath,
      uploadUrl,
      contentType,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'signed URL 실패'
    console.error('[private-trip-hero-folder/upload-sign]', e)
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }
}
