import { normalizeSupplierOrigin, type OverseasSupplierKey } from '@/lib/normalize-supplier-origin'
import type { RegisterRouteSupplierKey } from '@/lib/overseas-supplier-canonical-keys'

export type { RegisterRouteSupplierKey }

export type SupplierRouteMatchContext = {
  /** HTTP 경로 또는 식별용 문자열(로그·응답용). */
  route: string
}

export class SupplierRouteMismatchError extends Error {
  readonly expectedSupplier: RegisterRouteSupplierKey
  readonly receivedRaw: string
  readonly normalized: OverseasSupplierKey
  readonly route: string

  constructor(
    message: string,
    payload: {
      expectedSupplier: RegisterRouteSupplierKey
      receivedRaw: string
      normalized: OverseasSupplierKey
      route: string
    }
  ) {
    super(message)
    this.name = 'SupplierRouteMismatchError'
    this.expectedSupplier = payload.expectedSupplier
    this.receivedRaw = payload.receivedRaw
    this.normalized = payload.normalized
    this.route = payload.route
  }
}

/**
 * `originSource`가 라우트 기대 공급사와 일치하는지 검사한다.
 * `normalizeSupplierOrigin` 결과가 `etc` 이거나 기대와 다르면 throw(폴백 없음).
 */
export function assertRegisterRouteSupplierMatch(
  expected: RegisterRouteSupplierKey,
  bodyOriginSourceRaw: unknown,
  ctx: SupplierRouteMatchContext
): void {
  if (typeof bodyOriginSourceRaw !== 'string' || !bodyOriginSourceRaw.trim()) {
    throw new SupplierRouteMismatchError(
      `originSource is required: expected supplier "${expected}" for route ${ctx.route}, but originSource was missing or empty.`,
      {
        expectedSupplier: expected,
        receivedRaw: typeof bodyOriginSourceRaw === 'string' ? bodyOriginSourceRaw : '',
        normalized: 'etc',
        route: ctx.route,
      }
    )
  }
  const raw = bodyOriginSourceRaw.trim()
  const n = normalizeSupplierOrigin(raw)
  if (n === 'etc') {
    throw new SupplierRouteMismatchError(
      `originSource could not be resolved to a known supplier for route ${ctx.route}: expected "${expected}", received ${JSON.stringify(raw)}.`,
      {
        expectedSupplier: expected,
        receivedRaw: raw,
        normalized: n,
        route: ctx.route,
      }
    )
  }
  if (n !== expected) {
    throw new SupplierRouteMismatchError(
      `supplier route mismatch: route ${ctx.route} expects "${expected}", but originSource ${JSON.stringify(raw)} normalized to "${n}".`,
      {
        expectedSupplier: expected,
        receivedRaw: raw,
        normalized: n,
        route: ctx.route,
      }
    )
  }
}
