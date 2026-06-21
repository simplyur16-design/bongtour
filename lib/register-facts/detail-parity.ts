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

  push('priceRows', args.bundle.priceRows.filter((r) => (r.adultPrice ?? 0) > 0).length, args.detailPriceRows)
  push('includedBullets', args.bundle.includedBullets.length, args.detailIncludedCount)
  push('excludedBullets', args.bundle.excludedBullets.length, args.detailExcludedCount)
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
