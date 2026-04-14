import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { getImageStorageBucket } from '@/lib/object-storage'
import {
  getMonthlyCurationBrowserSupabaseClientConfig,
  isMonthlyCurationDirectBrowserUploadConfigured,
  signMonthlyCurationWebpDirectUpload,
} from '@/lib/monthly-curation-direct-upload-server'

/**
 * 시즌 추천 대표 이미지: 브라우저가 Supabase Storage로 직접 PUT하기 위한 signed upload 토큰 발급(nginx 413 회피).
 * 본문은 JSON만 받으며 파일 바이너리는 서버를 거치지 않는다.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }
  if (!isMonthlyCurationDirectBrowserUploadConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          '직접 업로드: SUPABASE_URL·SUPABASE_ANON_KEY(또는 NEXT_PUBLIC_* 동일 값)·SUPABASE_SERVICE_ROLE_KEY·Storage 버킷이 서버에 필요합니다. anon은 대시보드의 public anon 키입니다.',
      },
      { status: 400 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }
  const b = (body ?? {}) as Record<string, unknown>
  const monthKey = String(b.monthKey ?? '').trim()
  const title = String(b.title ?? '').trim()
  const byteLength = typeof b.byteLength === 'number' ? b.byteLength : Number(b.byteLength)
  const contentType = typeof b.contentType === 'string' ? b.contentType : ''

  try {
    const signed = await signMonthlyCurationWebpDirectUpload({
      monthKey,
      title,
      byteLength,
      contentType,
    })
    const clientCfg = getMonthlyCurationBrowserSupabaseClientConfig()
    if (!clientCfg) {
      return NextResponse.json({ ok: false, error: 'Supabase 클라이언트 설정을 만들 수 없습니다.' }, { status: 400 })
    }
    return NextResponse.json({
      ok: true,
      objectKey: signed.objectKey,
      token: signed.token,
      imageUrl: signed.imageUrl,
      imageStorageKey: signed.imageStorageKey,
      supabaseUrl: clientCfg.supabaseUrl,
      supabaseAnonKey: clientCfg.anonKey,
      bucket: getImageStorageBucket(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'signed URL 실패'
    console.error('[monthly-curation-contents/signed-upload]', e)
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }
}
