import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { getImageStorageBucket } from '@/lib/object-storage'
import {
  getPrivateTripHeroBrowserSupabaseClientConfig,
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
          '직접 업로드: SUPABASE_URL·SUPABASE_ANON_KEY(또는 NEXT_PUBLIC_* 동일 값)·SUPABASE_SERVICE_ROLE_KEY·Storage 버킷이 서버에 필요합니다. anon은 대시보드 API의 public anon 키입니다.',
      },
      { status: 400 },
    )
  }

  try {
    const body = (await request.json()) as { byteLength?: number; mimeType?: string }
    const byteLength = typeof body.byteLength === 'number' ? body.byteLength : Number(body.byteLength)
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''
    const { incomingPath, token } = await signPrivateTripHeroIncomingUpload({ byteLength, mimeType })
    const clientCfg = getPrivateTripHeroBrowserSupabaseClientConfig()
    if (!clientCfg) {
      return NextResponse.json({ ok: false, error: 'Supabase 클라이언트 설정을 만들 수 없습니다.' }, { status: 400 })
    }
    return NextResponse.json({
      ok: true,
      incomingPath,
      token,
      supabaseUrl: clientCfg.supabaseUrl,
      supabaseAnonKey: clientCfg.anonKey,
      bucket: getImageStorageBucket(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'signed URL 실패'
    console.error('[private-trip-hero-folder/upload-sign]', e)
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }
}
