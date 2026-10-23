/**
 * 「비슷한 일정」사실 체크리스트 비교 (우열·추천 문구 없음).
 * 동일 상품이 아니라 목적지+박일 후보 묶음만.
 * REGRESSION-FREEZE[compare-cluster-supplier-gap-ingest]: 등록대기로만 · missingCanonicalSuppliers — manifest
 * REGRESSION-FREEZE[similar-itinerary-compare-entry]: 공개는 place+duration 필수(프리셋 폴백 금지) — manifest
 */

import { prisma } from '@/lib/prisma'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import { publicProductPath } from '@/lib/product-public-path'
import {
  computeEffectivePricePerPersonKrwFromRow,
  PRODUCT_PRICE_FOR_BROWSE_INCLUDE,
} from '@/lib/product-price-per-person'
import {
  deriveAirlineFact,
  deriveHotelMealFact,
  deriveOptionalFact,
  deriveShoppingFact,
  formatFactTriState,
} from '@/lib/supplier-product-fact-ssot'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import {
  CANONICAL_OVERSEAS_SUPPLIER_KEYS,
  isCanonicalOverseasSupplierKey,
  type CanonicalOverseasSupplierKey,
} from '@/lib/overseas-supplier-canonical-keys'
import {
  compareDurationsMatch,
  comparePlaceClustersMatch,
  normalizeCompareDurationLabel,
  resolveComparePlaceCluster,
} from '@/lib/similar-itinerary-compare-cluster'

export type TriStateFact =
  | { kind: 'yes'; detail?: string }
  | { kind: 'no' }
  | { kind: 'unknown' }

export type SimilarItineraryCompareRow = {
  id: string
  slug: string | null
  href: string
  supplierKey: CanonicalOverseasSupplierKey | null
  supplierLabel: string
  title: string
  duration: string
  priceLabel: string
  airlineLabel: string
  shopping: TriStateFact
  optional: TriStateFact
  hotelLabel: string
  mealLabel: string
}

export type SimilarItineraryCompareBundle = {
  placeLabel: string
  durationLabel: string
  disclaimer: string
  rows: SimilarItineraryCompareRow[]
  /** 등록 클러스터에 없는 canonical 7사 — 갭 수집 대상 */
  missingSuppliers: CanonicalOverseasSupplierKey[]
}

/** 등록 상품 originSource 목록 → 비어 있는 canonical 공급사 */
export function missingCanonicalSuppliersFromOrigins(
  originSources: Array<string | null | undefined>,
): CanonicalOverseasSupplierKey[] {
  const present = new Set<CanonicalOverseasSupplierKey>()
  for (const raw of originSources) {
    const n = normalizeSupplierOrigin(raw)
    if (isCanonicalOverseasSupplierKey(n)) present.add(n)
  }
  return CANONICAL_OVERSEAS_SUPPLIER_KEYS.filter((k) => !present.has(k))
}

/** 등록 originSources + onlySuppliers 필터 → 갭 수집 대상 (이미 있는 공급사 제외) */
export function resolveCompareClusterGapIngestTargets(opts: {
  presentOrigins: Array<string | null | undefined>
  onlySuppliers?: string[] | null
}): CanonicalOverseasSupplierKey[] {
  // REGRESSION-FREEZE[compare-cluster-supplier-gap-ingest]: 이미 있는 공급사 제외 — manifest
  let missing = missingCanonicalSuppliersFromOrigins(opts.presentOrigins)
  const onlyRaw = opts.onlySuppliers?.map((s) => String(s || '').trim()).filter(Boolean) ?? []
  if (onlyRaw.length > 0) {
    const only = new Set<CanonicalOverseasSupplierKey>()
    for (const raw of onlyRaw) {
      const n = normalizeSupplierOrigin(raw)
      if (isCanonicalOverseasSupplierKey(n)) only.add(n)
    }
    missing = missing.filter((k) => only.has(k))
  }
  return missing
}

export const DEV_COMPARE_PRESETS = [
  { place: '상해', duration: '3박 4일', note: '공급사 5곳 — 기본 예시' },
  { place: '방콕', duration: '3박 5일', note: '요청 시나리오' },
  { place: '푸꾸옥', duration: '3박 5일', note: '공급사 4곳' },
  { place: '다낭', duration: '3박 5일', note: '공급사 3곳+' },
] as const

function toTriState(state: 'yes' | 'no' | 'unknown', visitCount?: number | null): TriStateFact {
  if (state === 'yes') {
    return visitCount != null && visitCount > 0
      ? { kind: 'yes', detail: `${visitCount}회` }
      : { kind: 'yes' }
  }
  if (state === 'no') return { kind: 'no' }
  return { kind: 'unknown' }
}

function priceLabel(krw: number | null | undefined): string {
  if (krw == null || !Number.isFinite(krw) || krw <= 0) return '정보 없음'
  return `${Math.round(krw).toLocaleString('ko-KR')}원~`
}

export function formatTriStateFact(f: TriStateFact): string {
  if (f.kind === 'yes') return f.detail ? `있음 (${f.detail})` : '있음'
  if (f.kind === 'no') return '없음'
  return '정보 없음'
}

export async function loadSimilarItineraryCompare(opts: {
  place?: string | null
  duration?: string | null
  /** admin/ops only — DEV_COMPARE_PRESETS 폴백. 공개 travel 페이지는 false. */
  allowPresetFallback?: boolean
}): Promise<SimilarItineraryCompareBundle> {
  const allowPreset = opts.allowPresetFallback === true
  const hasPlaceOpt = Boolean(String(opts.place || '').trim())
  const hasDurOpt = Boolean(String(opts.duration || '').trim())
  const placeRaw = String(
    opts.place || (allowPreset ? DEV_COMPARE_PRESETS[0].place : ''),
  ).trim()
  const durationRaw = String(
    opts.duration || (allowPreset ? DEV_COMPARE_PRESETS[0].duration : ''),
  ).trim()
  // REGRESSION-FREEZE[similar-itinerary-compare-cluster]: 로더는 메가메뉴 leaf·박일 정규화 — manifest
  // REGRESSION-FREEZE[similar-itinerary-compare-entry]: 공개는 프리셋으로 몰지 않음 — manifest
  const placeWant =
    hasPlaceOpt || allowPreset
      ? resolveComparePlaceCluster({
          placeQuery: placeRaw || (allowPreset ? DEV_COMPARE_PRESETS[0].place : ''),
        })
      : null
  const durationWant =
    hasDurOpt || allowPreset
      ? normalizeCompareDurationLabel(
          durationRaw || (allowPreset ? DEV_COMPARE_PRESETS[0].duration : ''),
        )
      : ''

  if (!placeWant || !durationWant) {
    return {
      placeLabel: placeWant?.label || placeRaw,
      durationLabel: durationWant,
      disclaimer:
        '동일한 상품이 아닙니다. 등록된 상품 중 목적지·박일이 비슷한 후보를 나란히 둔 사실 표입니다. 우열·추천 문구는 없습니다.',
      rows: [],
      missingSuppliers: [],
    }
  }

  const products = await prisma.product.findMany({
    where: { registrationStatus: 'registered', travelScope: 'overseas' },
    select: {
      id: true,
      slug: true,
      title: true,
      duration: true,
      primaryDestination: true,
      destination: true,
      originSource: true,
      priceFrom: true,
      minBookableAdultPrice: true,
      shoppingCount: true,
      shoppingVisitCountTotal: true,
      shoppingShopOptions: true,
      shoppingItems: true,
      shoppingCustomsNoticeRaw: true,
      hasOptionalTours: true,
      optionalToursStructured: true,
      hotelSummaryText: true,
      hotelSummaryRaw: true,
      includedText: true,
      excludedText: true,
      rawMeta: true,
      schedule: true,
      // REGRESSION-FREEZE[browse-price-product-price-fallback]: 비교표 인당가 = ProductPriceSelect — manifest
      // REGRESSION-FREEZE[similar-itinerary-compare-cluster]: departures는 가격+항공사 동시 select — manifest
      prices: PRODUCT_PRICE_FOR_BROWSE_INCLUDE.prices,
      departures: {
        select: {
          adultPrice: true,
          departureDate: true,
          carrierName: true,
        },
        orderBy: { departureDate: 'asc' },
        take: 80,
      },
      itineraryDays: {
        select: {
          day: true,
          hotelText: true,
          mealSummaryText: true,
          meals: true,
          breakfastText: true,
          lunchText: true,
          dinnerText: true,
        },
        orderBy: { day: 'asc' },
        take: 12,
      },
    },
  })

  const matched = placeWant
    ? products.filter((p) => {
        const place = resolveComparePlaceCluster({
          primaryDestination: p.primaryDestination,
          destination: p.destination,
          title: p.title,
        })
        const durOk = compareDurationsMatch(
          normalizeCompareDurationLabel(p.duration, p.title),
          durationWant,
        )
        return comparePlaceClustersMatch(placeWant, place) && durOk
      })
    : []

  const rows: SimilarItineraryCompareRow[] = matched.map((p) => {
    // REGRESSION-FREEZE[supplier-product-fact-ssot]: 비교표 사실 도출 — manifest
    const shop = deriveShoppingFact(p)
    const opt = deriveOptionalFact(p)
    const hm = deriveHotelMealFact(p)
    const airline = deriveAirlineFact(p)
    const originKey = normalizeSupplierOrigin(p.originSource)
    const supplierKey = isCanonicalOverseasSupplierKey(originKey) ? originKey : null
    return {
      id: p.id,
      slug: p.slug,
      href: publicProductPath({ id: p.id, slug: p.slug }),
      supplierKey,
      supplierLabel: formatOriginSourceForDisplay(p.originSource),
      title: String(p.title || '').trim() || '(제목 없음)',
      duration: normalizeCompareDurationLabel(p.duration, p.title) || '정보 없음',
      priceLabel: priceLabel(computeEffectivePricePerPersonKrwFromRow(p)),
      airlineLabel: airline.airlineLabel,
      shopping: toTriState(shop.state, shop.visitCount),
      optional: toTriState(opt.state),
      hotelLabel: hm.hotelLabel,
      mealLabel: hm.mealLabel,
    }
  })

  rows.sort((a, b) => {
    const s = a.supplierLabel.localeCompare(b.supplierLabel, 'ko')
    if (s !== 0) return s
    return a.title.localeCompare(b.title, 'ko')
  })

  // REGRESSION-FREEZE[compare-cluster-supplier-gap-ingest]: missingCanonicalSuppliers — manifest
  const missingSuppliers = missingCanonicalSuppliersFromOrigins(matched.map((p) => p.originSource))

  return {
    placeLabel: placeWant?.label || placeRaw,
    durationLabel: durationWant,
    disclaimer:
      '동일한 상품이 아닙니다. 등록된 상품 중 목적지·박일이 비슷한 후보를 나란히 둔 사실 표입니다. 우열·추천 문구는 없습니다. 빈 필드는 「정보 없음」이며 「없음」(확인된 0/false)과 구분합니다.',
    rows,
    missingSuppliers,
  }
}

// re-export for callers that format labels
export { formatFactTriState }
