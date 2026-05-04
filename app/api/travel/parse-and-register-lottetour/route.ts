import { NextResponse } from 'next/server'
import {
  assertRegisterRouteSupplierMatch,
  SupplierRouteMismatchError,
} from '@/lib/assert-supplier-route-match'
import { requireAdmin } from '@/lib/require-admin'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const R4_PRE_MSG = '롯데관광 등록 기능 풀카피 작업 중입니다. R-4-D에서 lib/parse-and-register-lottetour-handler.ts를 연결합니다.'

/**
 * 롯데관광(lottetour) 전용 등록 라우트 — R-4-Pre 단계에서는 503 고정.
 * R-4-D: `handleParseAndRegisterLottetourRequest`로 교체.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  let peek: unknown
  try {
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

  return NextResponse.json(
    {
      success: false,
      error: R4_PRE_MSG,
      code: 'LottetourMaintenance',
    },
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  )
}
