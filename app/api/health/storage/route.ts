import { NextResponse } from 'next/server'
import { getImageStorageBucket, isObjectStorageConfigured } from '@/lib/object-storage'

/**
 * Supabase Storage(이미지 업로드) 설정 여부 — 비밀값 없이 진단용.
 * 서버: `curl -sS https://도메인/api/health/storage | jq`
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const ok = isObjectStorageConfigured()
  return NextResponse.json(
    {
      ok: true,
      objectStorage: ok ? 'configured' : 'missing_env',
      bucket: ok ? getImageStorageBucket() : null,
      hint: ok
        ? null
        : 'SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 를 서버 .env에 설정하고 pm2 restart 하세요.',
    },
    { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
