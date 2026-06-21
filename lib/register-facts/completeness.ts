/**
 * register-facts 번들 — 상품상세 필수 축 completeness SSOT.
 * REGRESSION-FREEZE[register-facts-completeness]: auditRegisterFactBundleCompleteness — manifest
 */
import { parseRegisterFactProductKind } from '@/lib/register-facts/product-kind'
import type { SupplierRegisterFactBundle, SupplierRegisterFactSource } from '@/lib/register-facts/types'

export type RegisterFactCompletenessReport = {
  supplier: SupplierRegisterFactSource
  ok: boolean
  missing: string[]
  counts: {
    scheduleDays: number
    includedBullets: number
    excludedBullets: number
    flights: number
    priceRows: number
    shoppingPlaces: number
  }
}

const PACKAGE_REQUIRED_AXES = [
  'title',
  'priceRows',
  'scheduleDays',
  'includedExcluded',
  'flights',
] as const

const AIR_HOTEL_REQUIRED_AXES = ['title', 'priceRows', 'includedExcluded', 'flights'] as const

type RequiredAxis = (typeof PACKAGE_REQUIRED_AXES)[number] | (typeof AIR_HOTEL_REQUIRED_AXES)[number]

function requiredAxesForBundle(bundle: SupplierRegisterFactBundle): RequiredAxis[] {
  return parseRegisterFactProductKind(bundle) === 'air_hotel_free'
    ? [...AIR_HOTEL_REQUIRED_AXES]
    : [...PACKAGE_REQUIRED_AXES]
}

function hasBookablePrices(bundle: SupplierRegisterFactBundle): boolean {
  return bundle.priceRows.some((r) => (r.adultPrice ?? 0) > 0 && Boolean(r.departureDate?.trim()))
}

function hasIncludedExcluded(bundle: SupplierRegisterFactBundle): boolean {
  return bundle.includedBullets.length > 0 || bundle.excludedBullets.length > 0
}

function axisMissing(bundle: SupplierRegisterFactBundle, axis: RequiredAxis): boolean {
  switch (axis) {
    case 'title':
      return !bundle.title?.trim()
    case 'priceRows':
      return !hasBookablePrices(bundle)
    case 'scheduleDays':
      return bundle.scheduleDays.length === 0
    case 'includedExcluded':
      return !hasIncludedExcluded(bundle)
    case 'flights':
      return bundle.flights.every(
        (f) =>
          !(f.departureCity?.trim() || f.arrivalCity?.trim() || f.flightNo?.trim() || f.carrier?.trim()),
      )
    default:
      return false
  }
}

/** 6공급사 공통 — 상품상세 LLM 입력에 필요한 축이 채워졌는지 판정 */
export function auditRegisterFactBundleCompleteness(
  bundle: SupplierRegisterFactBundle,
): RegisterFactCompletenessReport {
  const missing = requiredAxesForBundle(bundle).filter((axis) => axisMissing(bundle, axis))
  return {
    supplier: bundle.supplier,
    ok: missing.length === 0,
    missing: [...missing],
    counts: {
      scheduleDays: bundle.scheduleDays.length,
      includedBullets: bundle.includedBullets.length,
      excludedBullets: bundle.excludedBullets.length,
      flights: bundle.flights.length,
      priceRows: bundle.priceRows.filter((r) => (r.adultPrice ?? 0) > 0).length,
      shoppingPlaces: bundle.shoppingPlaces.length,
    },
  }
}
