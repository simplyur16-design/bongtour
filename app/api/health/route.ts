import { NextResponse } from 'next/server'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import pkg from '../../../package.json'

/**
 * 공개 헬스체크 — UptimeRobot 등 외부 모니터용. 인증 없음·가벼운 응답.
 * (middleware matcher에 `/api/admin`만 있어 이 경로는 auth·레이트리밋 미적용)
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const timestamp = new Date().toISOString()
  return jsonWithLeakGuard(
    {
      ok: true,
      status: 'ok',
      service: 'bongtour',
      version: pkg.version,
      timestamp,
      ts: timestamp,
    },
    'health.service',
    { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
