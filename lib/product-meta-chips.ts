import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import { formatPublicAirlineDisplay } from '@/lib/airline-iata-public-display-ssot'
import { buildPublicProductBadges, inferFreeTimeFromSchedule, type ProductBadgeInput } from '@/lib/product-detail-badges'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import { inferFlightRoutingMeta, productHasFlightMetaContext } from '@/lib/flight-routing-meta'
import {
  type FlightStructuredBody,
} from '@/lib/public-product-extras'
import {
  deriveAirlineFact,
  deriveOptionalFact,
  deriveShoppingFact,
} from '@/lib/supplier-product-fact-ssot'

/** 상품 상세 히어로·여행요약 메타칩 (아이콘+라벨+값) */
export type ProductMetaChipKind = 'optional' | 'shopping' | 'freeTime' | 'airline' | 'flightRouting' | 'supplier'

export type ProductMetaChip = {
  kind: ProductMetaChipKind
  /** 라벨 옆에 붙는 짧은 값만 (예: 있음, 2회, 중국남방항공) */
  value: string
}

export type ProductMetaChipInput = ProductBadgeInput & {
  originSource?: string | null
  airline?: string | null
  hasOptionalTours?: boolean | null
  title?: string | null
  flightStructured?: FlightStructuredBody | null
  departureKeyFactsByDate?: Record<string, DepartureKeyFacts> | null
  /** 쇼핑 표 JSON — deriveShoppingFact 와 비교표 동일 입력 */
  shoppingShopOptions?: string | null
  /** `air_hotel_free` 일 때 패키지형 자유시간 메타칩 제외 */
  listingKind?: string | null
}

/** 긴 공급사 문구를 메타칩용으로 짧게 */
export function shortenFreeTimeForMeta(s: string): string {
  const t = s.trim()
  if (!t) return t
  if (/일정표\s*내\s*명시된\s*자유시간\s*없음/i.test(t)) return '없음'
  if (/명시된\s*자유시간\s*없음/i.test(t)) return '없음'
  if (/^자유시간\s*없음$/i.test(t)) return '없음'
  if (/^자유시간\s*있음/i.test(t)) {
    const rest = t.replace(/^자유시간\s*있음\s*/i, '').trim()
    if (!rest || /^세부는/i.test(rest)) return '있음'
  }
  let v = t.replace(/^일정표\s*내\s*명시된\s*/i, '').replace(/^자유시간\s*/i, '').trim()
  if (v.length > 42) v = v.slice(0, 39) + '…'
  return v || t
}

/** 칩 = 비교표 SSOT (`deriveOptionalFact`) — 별도 추론 금지 */
function optionalValue(product: ProductMetaChipInput): string {
  const fact = deriveOptionalFact({
    title: product.title,
    hasOptionalTours: product.hasOptionalTours,
    optionalToursStructured: product.optionalToursStructured,
    includedText: product.includedText,
    excludedText: product.excludedText,
  })
  if (fact.state === 'yes') return '있음'
  if (fact.state === 'no') return '없음'
  return '확인'
}

/** 칩 = 비교표 SSOT (`deriveShoppingFact`) — 별도 추론 금지 */
function shoppingValue(product: ProductMetaChipInput): string {
  const fact = deriveShoppingFact({
    originSource: product.originSource,
    title: product.title,
    shoppingCount: product.shoppingCount,
    shoppingVisitCountTotal: product.shoppingVisitCountTotal,
    shoppingItems: product.shoppingItems,
    shoppingShopOptions: product.shoppingShopOptions,
    shoppingCustomsNoticeRaw: product.shoppingNoticeRaw,
    includedText: product.includedText,
    excludedText: product.excludedText,
  })
  if (fact.state === 'yes') {
    if (fact.visitCount != null && fact.visitCount > 0) return `${fact.visitCount}회`
    return '있음'
  }
  if (fact.state === 'no') return '없음'
  return '확인'
}

function freeTimeValue(product: ProductMetaChipInput, headerBadges: string[]): string {
  if (product.freeTimeSummaryText?.trim()) {
    return shortenFreeTimeForMeta(product.freeTimeSummaryText)
  }
  if (product.hasFreeTime === false) return '없음'
  if (product.hasFreeTime === true) {
    const inferred = inferFreeTimeFromSchedule(product)
    return inferred ? shortenFreeTimeForMeta(inferred) : '있음'
  }
  const fromBadge = headerBadges.find((b) => /자유시간|자유\s*일정|개별/i.test(b))
  if (fromBadge) return shortenFreeTimeForMeta(fromBadge)
  return '확인'
}

function flightRoutingChipArgs(
  product: ProductMetaChipInput,
  departureFactsOverride?: DepartureKeyFacts | null,
  prioritizeDepartureFactsForRouting?: boolean
) {
  const routingInput = {
    title: product.title,
    includedText: product.includedText,
    excludedText: product.excludedText,
    flightStructured: product.flightStructured ?? null,
    departureKeyFactsByDate: product.departureKeyFactsByDate ?? null,
    departureFactsOverride: departureFactsOverride ?? null,
    prioritizeDepartureFactsForRouting: prioritizeDepartureFactsForRouting === true,
  }
  const routing = inferFlightRoutingMeta(routingInput)
  const hasFlightCtx = productHasFlightMetaContext({ ...routingInput, airline: product.airline })
  return { routing, hasFlightCtx }
}

/**
 * 히어로·여행요약 메타칩 데이터 — 동일 규칙으로 한 번만 계산해 전달
 */
export function buildProductMetaChips(
  product: ProductMetaChipInput,
  options?: {
    departureFactsOverride?: DepartureKeyFacts | null
    prioritizeDepartureFactsForRouting?: boolean
  }
): ProductMetaChip[] {
  const headerBadges = buildPublicProductBadges(product)
  const chips: ProductMetaChip[] = [
    { kind: 'optional', value: optionalValue(product) },
    { kind: 'shopping', value: shoppingValue(product) },
    { kind: 'freeTime', value: freeTimeValue(product, headerBadges) },
  ]
  // REGRESSION-FREEZE[public-hero-airline-iata-ko]: 메타칩 항공 IATA→한글 — manifest
  // 항공사 = deriveAirlineFact (비교표·상세 동일 축)
  const airlineFact = deriveAirlineFact({
    departureKeyFactsAirline: options?.departureFactsOverride?.airline ?? product.airline,
    selectedDepartureCarrierName: options?.departureFactsOverride?.airline ?? null,
    rawMeta: null,
  })
  const airlineRaw = product.airline?.trim()
  const airline =
    (airlineFact.source !== 'none' ? airlineFact.airlineLabel : null) ||
    formatPublicAirlineDisplay(airlineRaw) ||
    airlineRaw ||
    null
  const { routing, hasFlightCtx } = flightRoutingChipArgs(
    product,
    options?.departureFactsOverride,
    options?.prioritizeDepartureFactsForRouting
  )

  if (airline && airline !== '정보 없음') {
    chips.push({ kind: 'airline', value: airline })
    chips.push({ kind: 'flightRouting', value: routing.flightRoutingLabel })
  } else if (
    hasFlightCtx &&
    (routing.source !== 'default' || routing.flightRoutingLabel !== '직항')
  ) {
    chips.push({ kind: 'flightRouting', value: routing.flightRoutingLabel })
  }
  const supplierLabel = formatOriginSourceForDisplay(product.originSource)
  if (supplierLabel) {
    chips.push({ kind: 'supplier', value: supplierLabel })
  }

  if (product.listingKind === 'air_hotel_free') {
    return chips.filter((c) => c.kind !== 'shopping' && c.kind !== 'freeTime')
  }
  return chips
}
