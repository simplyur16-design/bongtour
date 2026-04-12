import { NextResponse } from 'next/server'
import {
  assertRegisterRouteSupplierMatch,
  SupplierRouteMismatchError,
} from '@/lib/assert-supplier-route-match'
import { handleParseAndRegisterHanatourRequest } from '@/lib/parse-and-register-hanatour-handler'
import { checkAdminApiRateLimit, getClientIp } from '@/lib/admin-api-security'
import { requireAdmin } from '@/lib/require-admin'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  const ip = getClientIp(request.headers)
  const { limited, retryAfterSec } = await checkAdminApiRateLimit(ip, 'expensive')
  if (limited) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    )
  }
  console.log(
    '[hanatour] phase=api-entry route=/api/travel/parse-and-register-hanatour supplier=hanatour'
  )
  try {
    let peek: unknown
    try {
      peek = await request.clone().json()
    } catch {
      return NextResponse.json(
        { success: false, error: '요청 본문이 올바른 JSON이 아닙니다.' },
        { status: 400 }
      )
    }
    if (!peek || typeof peek !== 'object' || Array.isArray(peek)) {
      return NextResponse.json(
        { success: false, error: '요청 본문은 JSON 객체여야 합니다.' },
        { status: 400 }
      )
    }
    assertRegisterRouteSupplierMatch('hanatour', (peek as Record<string, unknown>).originSource, {
      route: '/api/travel/parse-and-register-hanatour',
    })
  } catch (e) {
    if (e instanceof SupplierRouteMismatchError) {
      return NextResponse.json(
        {
          success: false,
          error: e.message,
          expectedSupplier: e.expectedSupplier,
          receivedOriginSource: e.receivedRaw,
          normalizedSupplier: e.normalized,
          route: e.route,
        },
        { status: 400 }
      )
    }
    throw e
  }
  return handleParseAndRegisterHanatourRequest(request)
}
