/**
 * register-facts ↔ *-register-detail-collect 교차검증 SSOT.
 * REGRESSION-FREEZE[register-facts-completeness]
 */
import type { SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { parseRegisterFactProductKind, type RegisterFactProductKind } from '@/lib/register-facts/product-kind'

export type RegisterFactDetailParityMismatch = {
  field: string
  facts: number | string | boolean
  detail: number | string | boolean
  severity: 'error' | 'warn'
}

export type RegisterFactDetailParityReport = {
  supplier: SupplierRegisterFactBundle['supplier']
  productKind: RegisterFactProductKind
  ok: boolean
  mismatches: RegisterFactDetailParityMismatch[]
}

function legHasSignal(bundle: SupplierRegisterFactBundle): boolean {
  return bundle.flights.some(
    (f) =>
      Boolean(f.departureCity?.trim()) ||
      Boolean(f.arrivalCity?.trim()) ||
      Boolean(f.flightNo?.trim()) ||
      Boolean(f.carrier?.trim()),
  )
}

/**
 * live 공급사 응답·두 수집 경로의 미세 차이는 절대 일치로 깨지기 쉽다.
 * 한쪽만 0이거나 상대 편차가 크면 error, 허용 범위 안이면 warn.
 */
function pushLiveCountParity(
  mismatches: RegisterFactDetailParityMismatch[],
  field: string,
  facts: number,
  detail: number,
  opts: { absWarn?: number; relWarn?: number } = {},
): void {
  if (facts === detail) return
  if ((facts === 0) !== (detail === 0)) {
    mismatches.push({ field, facts, detail, severity: 'error' })
    return
  }
  const abs = Math.abs(facts - detail)
  const rel = abs / Math.max(facts, detail, 1)
  const withinAbs = opts.absWarn != null && abs <= opts.absWarn
  const withinRel = opts.relWarn != null && rel <= opts.relWarn
  mismatches.push({
    field,
    facts,
    detail,
    severity: withinAbs || withinRel ? 'warn' : 'error',
  })
}

/** detail-collect 추출치와 register-facts 번들 필드 수·축 정합 */
export function auditRegisterFactDetailParity(args: {
  bundle: SupplierRegisterFactBundle
  detailScheduleDays: number
  detailIncludedCount: number
  detailExcludedCount: number
  detailShoppingCount: number
  detailFlightSignal: boolean
  detailPriceRows: number
}): RegisterFactDetailParityReport {
  const productKind = parseRegisterFactProductKind(args.bundle)
  const mismatches: RegisterFactDetailParityMismatch[] = []

  const push = (
    field: string,
    facts: number | string | boolean,
    detail: number | string | boolean,
    severity: RegisterFactDetailParityMismatch['severity'] = 'error',
  ) => {
    if (facts === detail) return
    mismatches.push({ field, facts, detail, severity })
  }

  // REGRESSION-FREEZE[register-facts-completeness]: live 달력·포함문구 절대일치 금지 — manifest
  pushLiveCountParity(
    mismatches,
    'priceRows',
    args.bundle.priceRows.filter((r) => (r.adultPrice ?? 0) > 0).length,
    args.detailPriceRows,
    { relWarn: 0.4 },
  )
  pushLiveCountParity(mismatches, 'includedBullets', args.bundle.includedBullets.length, args.detailIncludedCount, {
    absWarn: 5,
  })
  pushLiveCountParity(mismatches, 'excludedBullets', args.bundle.excludedBullets.length, args.detailExcludedCount, {
    absWarn: 5,
  })
  push('shoppingPlaces', args.bundle.shoppingPlaces.length, args.detailShoppingCount, 'warn')

  if (productKind === 'package') {
    push('scheduleDays', args.bundle.scheduleDays.length, args.detailScheduleDays)
  } else {
    // 자유여행 — 일정표 대신 호텔·포함 축이 SSOT
    if (args.bundle.scheduleDays.length > 0 && args.detailScheduleDays === 0) {
      mismatches.push({
        field: 'scheduleDays_air_hotel',
        facts: args.bundle.scheduleDays.length,
        detail: args.detailScheduleDays,
        severity: 'warn',
      })
    }
  }

  push('flights', legHasSignal(args.bundle), args.detailFlightSignal)

  const errors = mismatches.filter((m) => m.severity === 'error')
  return {
    supplier: args.bundle.supplier,
    productKind,
    ok: errors.length === 0,
    mismatches,
  }
}
