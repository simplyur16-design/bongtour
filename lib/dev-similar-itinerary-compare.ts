/**
 * 「비슷한 일정」사실 체크리스트 비교 (우열·추천 문구 없음).
 * 동일 상품이 아니라 목적지+박일 후보 묶음만.
 * REGRESSION-FREEZE[compare-cluster-supplier-gap-ingest]: 등록대기로만 · missingCanonicalSuppliers — manifest
 * REGRESSION-FREEZE[similar-itinerary-compare-entry]: 공개는 place+duration 필수(프리셋 폴백 금지) — manifest
 */

import { prisma } from '@/lib/prisma'
import {
  productMatchesSimilarItineraryCompareKind,
  prismaWhereForSimilarItineraryCompareKind,
  similarItineraryCompareDisclaimer,
} from '@/lib/similar-itinerary-compare-kind'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import { publicProductPath } from '@/lib/product-public-path'
import { resolvePublicBrowseCardTitle } from '@/lib/bongtour-product-display-title-ssot'
import { normalizeSupplierRegisterListingTitle } from '@/lib/supplier-product-title-display'
import { computeEffectivePricePerPersonKrwFromRow } from '@/lib/product-price-per-person'
import {
  parseSimilarItineraryCompareKind,
  type SimilarItineraryCompareKind,
} from '@/lib/similar-itinerary-compare-href'
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
import { deriveTripNightsDays } from '@/lib/derive-trip-nights-days'
import {
  comparePlaceClustersMatch,
  comparePlaceDbSearchTerms,
  compareProductTripLengths,
  normalizeCompareDurationLabel,
  resolveComparePlaceCluster,
} from '@/lib/similar-itinerary-compare-cluster'
import {
  pickGloballyCheapestDepartureRowByAdultPrice,
  publicDateKeyFromRowDate,
} from '@/lib/public-default-departure-selection'
import {
  formatCompareDayLabel,
  formatCompareWeekPriceLabel,
  listCompareWeekOptions,
  parseCompareWeekParam,
  pickCompareWeekDeparture,
  resolveSelectedCompareWeek,
  toCompareWeekRows,
  type CompareWeekOption,
  type CompareWeekRow,
} from '@/lib/similar-itinerary-compare-week'

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
  /** 같은 출발 주간 — 그 주 성인가가 낮은 출발 1건의 DB 가격(원). 그 주 출발 없으면 null */
  weekAdultKrw: number | null
  weekPriceLabel: string
  /** 그 출발의 날짜 YMD / 표시 `11/12(목)` */
  weekDepartureYmd: string | null
  weekDepartureLabel: string
}

export type SimilarItineraryCompareBundle = {
  placeLabel: string
  durationLabel: string
  disclaimer: string
  rows: SimilarItineraryCompareRow[]
  /** 등록 클러스터에 없는 canonical 7사 — 갭 수집 대상 */
  missingSuppliers: CanonicalOverseasSupplierKey[]
  /** 같은 출발 주간 — 고를 수 있는 주(이른 주부터), 선택된 주 월요일 YMD, 그 주 출발이 없어 빠진 후보 수 */
  weekOptions: CompareWeekOption[]
  selectedWeekStartYmd: string | null
  rowsWithoutWeekDepartureCount: number
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

/**
 * 비교표 항공사 — 상세 meta chip과 동일 축.
 * 기본(최저가) 출발일 carrier ≈ departureKeyFacts.airline; 없으면 Product.airline.
 * 첫 출발행 carrier를 key-facts로 위장하지 않음.
 */
export function resolveCompareAirlineLabel(input: {
  airline?: string | null
  prices?: Array<{ id: string; date: string; adult?: number | null }> | null
  departures?: Array<{
    departureDate: Date | string
    carrierName?: string | null
  }> | null
  baseDate?: Date
}): string {
  const priceRows = (input.prices ?? []).map((pr) => ({
    id: String(pr.id),
    date: String(pr.date),
    adult: pr.adult,
  }))
  const defaultPriceRow = pickGloballyCheapestDepartureRowByAdultPrice(
    priceRows,
    input.baseDate,
  )
  const selectedDateKey = defaultPriceRow
    ? publicDateKeyFromRowDate(defaultPriceRow.date)
    : null
  const selectedDepCarrier = selectedDateKey
    ? (input.departures ?? []).find((d) => {
        const depKey =
          d.departureDate instanceof Date
            ? d.departureDate.toISOString().slice(0, 10)
            : String(d.departureDate).slice(0, 10)
        return depKey === selectedDateKey
      })?.carrierName ?? null
    : null
  return deriveAirlineFact({
    departureKeyFactsAirline: selectedDepCarrier ?? input.airline ?? null,
    selectedDepartureCarrierName: selectedDepCarrier ?? null,
    rawMeta: null,
  }).airlineLabel
}

export function formatTriStateFact(f: TriStateFact): string {
  if (f.kind === 'yes') return f.detail ? `있음 (${f.detail})` : '있음'
  if (f.kind === 'no') return '없음'
  return '정보 없음'
}

export async function loadSimilarItineraryCompare(opts: {
  place?: string | null
  duration?: string | null
  /** package=해외패키지, fit=자유여행 — 혼입 금지 */
  kind?: SimilarItineraryCompareKind | string | null
  /** admin/ops only — DEV_COMPARE_PRESETS 폴백. 공개 travel 페이지는 false. */
  allowPresetFallback?: boolean
  /** 같은 출발 주간 `?week=YYYY-MM-DD`(그 주 아무 날짜) — 없거나 목록 밖이면 가까운 주 */
  week?: string | null
  /**
   * true = 공개 비교표: 고른 주에 출발이 있는 후보만 rows 에 남김.
   * 기본 false — 관리자·갭 수집(compare-cluster-supplier-gap-ingest)은 전 후보 기준 그대로(주 칸만 채움).
   */
  applyWeekFilter?: boolean
  /** 테스트용 기준 시각 */
  baseDate?: Date
}): Promise<SimilarItineraryCompareBundle> {
  const baseDate = opts.baseDate ?? new Date()
  // REGRESSION-FREEZE[similar-itinerary-compare-kind-split]: kind로 패키지/FIT 분리 — manifest
  const compareKind = parseSimilarItineraryCompareKind(opts.kind)
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
      disclaimer: similarItineraryCompareDisclaimer(compareKind),
      rows: [],
      missingSuppliers: [],
      weekOptions: [],
      selectedWeekStartYmd: null,
      rowsWithoutWeekDepartureCount: 0,
    }
  }

  // REGRESSION-FREEZE[similar-itinerary-compare-cluster]: DB는 leaf alias로 좁힘 — overseas 전량 금지 — manifest
  const placeTerms = comparePlaceDbSearchTerms(placeWant)
  if (placeTerms.length === 0) {
    return {
      placeLabel: placeWant.label,
      durationLabel: durationWant,
      disclaimer: similarItineraryCompareDisclaimer(compareKind),
      rows: [],
      missingSuppliers: [],
      weekOptions: [],
      selectedWeekStartYmd: null,
      rowsWithoutWeekDepartureCount: 0,
    }
  }
  const placeOr = placeTerms.flatMap((t) => [
    { primaryDestination: { contains: t } },
    { destination: { contains: t } },
    { title: { contains: t } },
  ])

  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      travelScope: 'overseas',
      OR: placeOr,
      // REGRESSION-FREEZE[similar-itinerary-compare-kind-split]: DB where kind push-down — take 전 적용 — manifest
      AND: [prismaWhereForSimilarItineraryCompareKind(compareKind)],
    },
    take: 400,
    select: {
      id: true,
      slug: true,
      title: true,
      duration: true,
      tripNights: true,
      tripDays: true,
      primaryDestination: true,
      destination: true,
      listingKind: true,
      productType: true,
      originSource: true,
      airline: true,
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
      // REGRESSION-FREEZE[browse-price-product-price-fallback]: 비교표 인당가 = ProductPriceSelect — manifest
      // REGRESSION-FREEZE[similar-itinerary-compare-cluster]: departures는 가격+항공사 동시 select — manifest
      prices: {
        select: { id: true, date: true, adult: true },
        take: 20,
        orderBy: { date: 'asc' as const },
      },
      // REGRESSION-FREEZE[similar-itinerary-compare-week]: 주간 비교는 지난 출발 빼고 DB adultPrice 만 — manifest
      departures: {
        where: { departureDate: { gte: new Date(baseDate.getTime() - 2 * 24 * 60 * 60 * 1000) } },
        select: {
          id: true,
          adultPrice: true,
          departureDate: true,
          carrierName: true,
          statusRaw: true,
          seatsStatusRaw: true,
          seatCount: true,
          isBookable: true,
        },
        orderBy: { departureDate: 'asc' },
        take: 160,
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
        take: 10,
      },
    },
  })

  const durationWantInput = {
    duration: durationRaw || (allowPreset ? DEV_COMPARE_PRESETS[0].duration : ''),
    title: null as string | null,
  }

  const matched = placeWant
    ? products.filter((p) => {
        const place = resolveComparePlaceCluster({
          primaryDestination: p.primaryDestination,
          destination: p.destination,
          title: p.title,
        })
        const scheduleDayCount = Array.isArray(p.itineraryDays) ? p.itineraryDays.length : null
        const durOk = compareProductTripLengths(
          {
            duration: p.duration,
            title: p.title,
            tripNights: p.tripNights,
            tripDays: p.tripDays,
            scheduleDayCount,
          },
          durationWantInput,
        )
        if (!comparePlaceClustersMatch(placeWant, place) || !durOk) return false
        // REGRESSION-FREEZE[similar-itinerary-compare-week]: 기존 7개 공급사만(신규 공급사 추가 금지) — manifest
        if (!isCanonicalOverseasSupplierKey(normalizeSupplierOrigin(p.originSource))) return false
        // REGRESSION-FREEZE[similar-itinerary-compare-kind-split]: 패키지 표에 FIT 금지·반대도 금지 — manifest
        return productMatchesSimilarItineraryCompareKind(p, compareKind)
      })
    : []

  // REGRESSION-FREEZE[similar-itinerary-compare-week]: 같은 출발 주간 — 기본은 가까운 주, 사용자가 주를 고름 — manifest
  const weekRowsById = new Map<string, CompareWeekRow[]>(
    matched.map((p) => [p.id, toCompareWeekRows(p.departures ?? [])]),
  )
  const weekOptions = listCompareWeekOptions(
    matched.map((p) => ({
      id: p.id,
      supplierKey: normalizeSupplierOrigin(p.originSource),
      rows: weekRowsById.get(p.id) ?? [],
    })),
    baseDate,
  )
  const selectedWeekStartYmd = resolveSelectedCompareWeek(parseCompareWeekParam(opts.week), weekOptions)

  const allRows: SimilarItineraryCompareRow[] = matched.map((p) => {
    const weekPick = selectedWeekStartYmd
      ? pickCompareWeekDeparture(weekRowsById.get(p.id) ?? [], selectedWeekStartYmd, baseDate)
      : null
    // REGRESSION-FREEZE[supplier-product-fact-ssot]: 비교표 사실 도출 — manifest
    const shop = deriveShoppingFact(p)
    const opt = deriveOptionalFact(p)
    const hm = deriveHotelMealFact({
      ...p,
      listingKind: p.listingKind,
      productType: p.productType,
      slug: p.slug,
    })
    const airlineLabel = resolveCompareAirlineLabel({
      airline: p.airline,
      prices: (p.prices ?? []).map((pr) => ({
        id: String(pr.id),
        date: String(pr.date),
        adult: pr.adult,
      })),
      departures: p.departures,
    })
    // 주간 출발이 있으면 그 출발 회차 항공사(A-5: 가격·출발일·항공사 한 회차로 맞춤)
    const weekCarrier = weekPick?.carrierName?.trim() || null
    const airlineLabelForRow = weekCarrier
      ? deriveAirlineFact({
          departureKeyFactsAirline: weekCarrier,
          selectedDepartureCarrierName: weekCarrier,
          rawMeta: null,
        }).airlineLabel
      : airlineLabel
    const originKey = normalizeSupplierOrigin(p.originSource)
    const supplierKey = isCanonicalOverseasSupplierKey(originKey) ? originKey : null
    const scheduleDayCount = Array.isArray(p.itineraryDays) ? p.itineraryDays.length : null
    const tripLen = deriveTripNightsDays({
      duration: p.duration,
      title: p.title,
      tripNights: p.tripNights,
      tripDays: p.tripDays,
      scheduleDayCount,
    })
    return {
      id: p.id,
      slug: p.slug,
      href: publicProductPath({ id: p.id, slug: p.slug }),
      supplierKey,
      supplierLabel: formatOriginSourceForDisplay(p.originSource),
      // REGRESSION-FREEZE[public-card-hero-short-title]: 비교표도 권역헤더·EN 키워드 오염 제거 — manifest
      // plan-b-v6: 비교 노출도 디스플레이 클린 (DB 원문 유지)
      title: (() => {
        const planB =
          normalizeSupplierRegisterListingTitle(String(p.title || '')) ||
          String(p.title || '').trim() ||
          '(제목 없음)'
        return (
          resolvePublicBrowseCardTitle(
            {
              title: p.title,
              duration: p.duration,
              primaryDestination: p.primaryDestination,
              destination: p.destination,
            },
            planB,
          ).cardTitle || planB
        )
      })(),
      duration: tripLen.label || normalizeCompareDurationLabel(p.duration, p.title) || '정보 없음',
      priceLabel: priceLabel(computeEffectivePricePerPersonKrwFromRow(p)),
      airlineLabel: airlineLabelForRow,
      shopping: toTriState(shop.state, shop.visitCount),
      optional: toTriState(opt.state),
      hotelLabel: hm.hotelLabel,
      mealLabel: hm.mealLabel,
      weekAdultKrw: weekPick?.adultKrw ?? null,
      weekPriceLabel: formatCompareWeekPriceLabel(weekPick?.adultKrw ?? null),
      weekDepartureYmd: weekPick?.dateYmd ?? null,
      weekDepartureLabel: weekPick ? formatCompareDayLabel(weekPick.dateYmd) : '—',
    }
  })

  // 같은 출발 주간 조건: 고른 주에 예약가능 출발이 있는 후보만 표에 남김
  const rows = opts.applyWeekFilter === true && selectedWeekStartYmd ? allRows.filter((r) => r.weekAdultKrw != null) : allRows
  const rowsWithoutWeekDepartureCount = allRows.length - rows.length

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
    // REGRESSION-FREEZE[similar-itinerary-compare-kind-split]: disclaimer도 kind 분리 — manifest
    disclaimer: similarItineraryCompareDisclaimer(compareKind),
    rows,
    missingSuppliers,
    weekOptions,
    selectedWeekStartYmd,
    rowsWithoutWeekDepartureCount,
  }
}

// re-export for callers that format labels
export { formatFactTriState }
