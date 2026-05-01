import { NextResponse } from 'next/server'

/**
 * @deprecated 2026-04-22 — 서버 경유 업로드로 통일 (`POST …/upload` + `uploadStorageObject` / sharp WebP 자동 최적화).
 * 롤백·참고용으로 아래 블록 주석에 이전 구현을 남긴다. 라우트는 항상 410 Gone.
 */
export async function POST(_request: Request) {
  return NextResponse.json(
    {
      ok: false,
      error:
        '이 엔드포인트는 사용되지 않습니다. POST /api/admin/monthly-curation-contents/upload (FormData)를 사용하세요.',
    },
    { status: 410 },
  )
}

/*
 * === ROLLBACK: signed-upload POST (2026-04-22 이전) ===
 *
 * import { NextResponse } from 'next/server'
 * import { requireAdmin } from '@/lib/require-admin'
 * import { getImageStorageBucket } from '@/lib/object-storage'
 * import {
 *   getMonthlyCurationBrowserSupabaseClientConfig,
 *   isMonthlyCurationDirectBrowserUploadConfigured,
 *   signMonthlyCurationWebpDirectUpload,
 * } from '@/lib/monthly-curation-direct-upload-server'
 *
 * export async function POST(request: Request) {
 *   const admin = await requireAdmin()
 *   if (!admin) {
 *     return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
 *   }
 *   if (!isMonthlyCurationDirectBrowserUploadConfigured()) {
 *     return NextResponse.json(
 *       {
 *         ok: false,
 *         error:
 *           '직접 업로드: SUPABASE_URL·SUPABASE_ANON_KEY(또는 NEXT_PUBLIC_* 동일 값)·SUPABASE_SERVICE_ROLE_KEY·Storage 버킷이 서버에 필요합니다. anon은 대시보드의 public anon 키입니다.',
 *       },
 *       { status: 400 },
 *     )
 *   }
 *
 *   let body: unknown
 *   try {
 *     body = await request.json()
 *   } catch {
 *     return NextResponse.json({ ok: false, error: 'JSON 본문이 필요합니다.' }, { status: 400 })
 *   }
 *   const b = (body ?? {}) as Record<string, unknown>
 *   const monthKey = String(b.monthKey ?? '').trim()
 *   const title = String(b.title ?? '').trim()
 *   const byteLength = typeof b.byteLength === 'number' ? b.byteLength : Number(b.byteLength)
 *   const contentType = typeof b.contentType === 'string' ? b.contentType : ''
 *
 *   try {
 *     const signed = await signMonthlyCurationWebpDirectUpload({
 *       monthKey,
 *       title,
 *       byteLength,
 *       contentType,
 *     })
 *     const clientCfg = getMonthlyCurationBrowserSupabaseClientConfig()
 *     if (!clientCfg) {
 *       return NextResponse.json({ ok: false, error: 'Supabase 클라이언트 설정을 만들 수 없습니다.' }, { status: 400 })
 *     }
 *     return NextResponse.json({
 *       ok: true,
 *       objectKey: signed.objectKey,
 *       token: signed.token,
 *       imageUrl: signed.imageUrl,
 *       imageStorageKey: signed.imageStorageKey,
 *       supabaseUrl: clientCfg.supabaseUrl,
 *       supabaseAnonKey: clientCfg.anonKey,
 *       bucket: getImageStorageBucket(),
 *     })
 *   } catch (e) {
 *     const msg = e instanceof Error ? e.message : 'signed URL 실패'
 *     console.error('[monthly-curation-contents/signed-upload]', e)
 *     return NextResponse.json({ ok: false, error: msg }, { status: 400 })
 *   }
 * }
 */
