import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import {
  isPrivateTripHeroDirectBrowserUploadConfigured,
  signPrivateTripHeroIncomingUpload,
} from '@/lib/private-trip-hero-direct-upload-server'

/**
 * 브라우저가 원본을 Supabase Storage로 직접 PUT하기 위한 signed upload 토큰 발급(nginx 본문 한도 회피).
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
          '직접 업로드 경로를 쓰려면 NEXT_PUBLIC_SUPABASE_URL·NEXT_PUBLIC_SUPABASE_ANON_KEY와 Storage(service role) 설정이 필요합니다.',
      },
      { status: 400 },
    )
  }

  try {
    const body = (await request.json()) as { byteLength?: number; mimeType?: string }
    const byteLength = typeof body.byteLength === 'number' ? body.byteLength : Number(body.byteLength)
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''
    const { incomingPath, token } = await signPrivateTripHeroIncomingUpload({ byteLength, mimeType })
    return NextResponse.json({ ok: true, incomingPath, token })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'signed URL 실패'
    console.error('[private-trip-hero-folder/upload-sign]', e)
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }
}
