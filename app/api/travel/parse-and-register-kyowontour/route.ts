import { NextResponse } from 'next/server'
import {
  assertRegisterRouteSupplierMatch,
  SupplierRouteMismatchError,
} from '@/lib/assert-supplier-route-match'
import { handleParseAndRegisterKyowontourRequest } from '@/lib/parse-and-register-kyowontour-handler'
import { requireAdmin } from '@/lib/require-admin'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

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
    assertRegisterRouteSupplierMatch('kyowontour', (peek as Record<string, unknown>).originSource, {
      route: '/api/travel/parse-and-register-kyowontour',
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

  const o = peek as Record<string, unknown>
  const bodyTextRaw =
    typeof o.bodyText === 'string'
      ? o.bodyText
      : typeof o.text === 'string'
        ? o.text
        : typeof o.pastedBody === 'string'
          ? o.pastedBody
          : ''
  const merged = { ...o, bodyText: bodyTextRaw.trim() ? bodyTextRaw : o.bodyText }
  const nextRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(merged),
  })
  return handleParseAndRegisterKyowontourRequest(nextRequest)
}
