/**
 * 노랑풍선(ybtour) 등록 API — HTTP 진입점 SSOT.
 * 레거시 HTTP 경로 `parse-and-register-yellowballoon`은 동일 핸들러이나 **canonical supplier·originSource는 `ybtour`만**(레거시 토큰 `yellowballoon`은 정규화 시 `ybtour`로 수렴, canonical 값으로는 사용하지 않음).
 */
import {
  assertRegisterRouteSupplierMatch,
  SupplierRouteMismatchError,
} from '@/lib/assert-supplier-route-match'
import { handleParseAndRegisterYbtourRequest } from '@/lib/parse-and-register-ybtour-handler'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { requireAdmin } from '@/lib/require-admin'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return jsonWithLeakGuard({ error: '인증이 필요합니다.' }, 'travel.parse-and-register-ybtour.auth', { status: 401 })
  }
  console.log(
    '[ybtour] phase=register-api entry route=parse-and-register-ybtour forcedBrandKey=ybtour'
  )
  try {
    let peek: unknown
    try {
      peek = await request.clone().json()
    } catch {
      return jsonWithLeakGuard(
        { success: false, error: '요청 본문이 올바른 JSON이 아닙니다.' },
        'travel.parse-and-register-ybtour.bad-json',
        { status: 400 },
      )
    }
    if (!peek || typeof peek !== 'object' || Array.isArray(peek)) {
      return jsonWithLeakGuard(
        { success: false, error: '요청 본문은 JSON 객체여야 합니다.' },
        'travel.parse-and-register-ybtour.bad-shape',
        { status: 400 },
      )
    }
    assertRegisterRouteSupplierMatch('ybtour', (peek as Record<string, unknown>).originSource, {
      route: '/api/travel/parse-and-register-ybtour',
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
        'travel.parse-and-register-ybtour.supplier-mismatch',
        { status: 400 },
      )
    }
    throw e
  }
  return handleParseAndRegisterYbtourRequest(request)
}
