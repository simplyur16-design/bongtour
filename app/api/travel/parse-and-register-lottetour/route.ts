/**
 * 롯데관광(lottetour) 등록 HTTP 진입점 SSOT.
 * `originSource`는 `assertRegisterRouteSupplierMatch`로 `lottetour`와 일치해야 한다.
 */
import { NextResponse } from 'next/server'
import {
  assertRegisterRouteSupplierMatch,
  SupplierRouteMismatchError,
} from '@/lib/assert-supplier-route-match'
import { handleParseAndRegisterLottetourRequest } from '@/lib/parse-and-register-lottetour-handler'
import { requireAdmin } from '@/lib/require-admin'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  console.log(
    '[lottetour] phase=register-route entry route=parse-and-register-lottetour forcedBrandKey=lottetour'
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
    assertRegisterRouteSupplierMatch('lottetour', (peek as Record<string, unknown>).originSource, {
      route: '/api/travel/parse-and-register-lottetour',
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
  return handleParseAndRegisterLottetourRequest(request)
}
