import {
  assertRegisterRouteSupplierMatch,
  SupplierRouteMismatchError,
} from '@/lib/assert-supplier-route-match'
import { handleParseAndRegisterModetourRequest } from '@/lib/parse-and-register-modetour-handler'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { requireAdmin } from '@/lib/require-admin'

/** 풀 등록·일정 보강 Gemini 호출이 길어질 수 있음 — 호스팅 한도 내에서 상한 확장 */
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return jsonWithLeakGuard({ error: '인증이 필요합니다.' }, 'travel.parse-and-register-modetour.auth', {
      status: 401,
    })
  }
  try {
    let peek: unknown
    try {
      peek = await request.clone().json()
    } catch {
      return jsonWithLeakGuard(
        { success: false, error: '요청 본문이 올바른 JSON이 아닙니다.' },
        'travel.parse-and-register-modetour.bad-json',
        { status: 400 },
      )
    }
    if (!peek || typeof peek !== 'object' || Array.isArray(peek)) {
      return jsonWithLeakGuard(
        { success: false, error: '요청 본문은 JSON 객체여야 합니다.' },
        'travel.parse-and-register-modetour.bad-shape',
        { status: 400 },
      )
    }
    assertRegisterRouteSupplierMatch('modetour', (peek as Record<string, unknown>).originSource, {
      route: '/api/travel/parse-and-register-modetour',
    })
  } catch (e) {
    if (e instanceof SupplierRouteMismatchError) {
      return jsonWithLeakGuard(
        {
          success: false,
          error: e.message,
          expectedSupplier: e.expectedSupplier,
          receivedOriginSource: e.receivedRaw,
          normalizedSupplier: e.normalized,
          route: e.route,
        },
        'travel.parse-and-register-modetour.supplier-mismatch',
        { status: 400 },
      )
    }
    throw e
  }
  return handleParseAndRegisterModetourRequest(request)
}
