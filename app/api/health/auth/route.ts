import { NextResponse } from 'next/server'
import { probeAuthHealth } from '@/lib/auth-health-probe'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'

export const dynamic = 'force-dynamic'

/**
 * 로그인 장애 시 운영 점검용 — 비밀값은 노출하지 않음.
 * GET https://bongtour.com/api/health/auth
 */
export async function GET() {
  const probe = await probeAuthHealth()
  return jsonWithLeakGuard(probe, 'health.auth', {
    status: probe.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}

export async function HEAD() {
  const probe = await probeAuthHealth()
  return new NextResponse(null, {
    status: probe.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
