import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import { buildPublicProductBadges, inferFreeTimeFromSchedule, type ProductBadgeInput } from '@/lib/product-detail-badges'
import { inferFlightRoutingMeta, productHasFlightMetaContext } from '@/lib/flight-routing-meta'
import {
  buildPublicShoppingDisplayInputFromProductFields,
  type FlightStructuredBody,
  type ShoppingStopRow,
  shouldShowPublicShoppingSection,
} from '@/lib/public-product-extras'

/** 상품 상세 히어로·여행요약 메타칩 (아이콘+라벨+값) */
export type ProductMetaChipKind = 'optional' | 'shopping' | 'freeTime' | 'airline' | 'flightRouting'

export type ProductMetaChip = {
  kind: ProductMetaChipKind
  /** 라벨 옆에 붙는 짧은 값만 (예: 있음, 2회, 중국남방항공) */
  value: string
}

export type ProductMetaChipInput = ProductBadgeInput & {
  airline?: string | null
  hasOptionalTours?: boolean | null
  title?: string | null
  flightStructured?: FlightStructuredBody | null
  departureKeyFactsByDate?: Record<string, DepartureKeyFacts> | null
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

function optionalValue(product: ProductMetaChipInput, headerBadges: string[]): string {
  if (headerBadges.some((b) => b.includes('현지옵션'))) {
    const raw = headerBadges.find((b) => b.includes('현지옵션')) ?? '현지옵션 있음'
    if (/없음/.test(raw)) return '없음'
    if (/있음/.test(raw)) return '있음'
    return raw.replace(/^현지옵션\s*/, '').trim() || raw
  }
  if (product.hasOptionalTours === true) return '있음'
  if (product.hasOptionalTours === false) return '없음'
  return '확인'
}

function shoppingValue(product: ProductMetaChipInput, headerBadges: string[]): string {
  const shoppingDisplayInput = buildPublicShoppingDisplayInputFromProductFields({
    shoppingStopsStructured: product.shoppingStopsStructured as ShoppingStopRow[] | null | undefined,
    shoppingVisitCountTotal: product.shoppingVisitCountTotal,
    shoppingCount: product.shoppingCount,
    shoppingItems: product.shoppingItems,
    shoppingNoticeRaw: product.shoppingNoticeRaw,
    shoppingPasteRaw: product.shoppingPasteRaw,
  })
  const hasShoppingTab = shouldShowPublicShoppingSection(shoppingDisplayInput)

  if (product.shoppingVisitCountTotal != null && product.shoppingVisitCountTotal >= 0) {
    const v = product.shoppingVisitCountTotal
    if (v > 0) return `${v}회`
    if (v === 0 && !hasShoppingTab) return '없음'
    if (v === 0 && hasShoppingTab) return '있음'
  }
  if (headerBadges.some((b) => b.includes('쇼핑'))) {
    const raw = headerBadges.find((b) => b.includes('쇼핑')) ?? '쇼핑 없음'
    if (/없음/.test(raw) && !/\d/.test(raw)) return '없음'
    if (/있음/.test(raw) && !/\d/.test(raw)) return '있음'
    const m = raw.match(/(\d+)\s*회/)
    if (m) return `${m[1]}회`
    return raw.replace(/^쇼핑\s*(총\s*)?/i, '').trim() || raw
  }
  return '없음'
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

function flightRoutingChipArgs(product: ProductMetaChipInput, departureFactsOverride?: DepartureKeyFacts | null) {
  const routingInput = {
    title: product.title,
    includedText: product.includedText,
    excludedText: product.excludedText,
    flightStructured: product.flightStructured ?? null,
    departureKeyFactsByDate: product.departureKeyFactsByDate ?? null,
    departureFactsOverride: departureFactsOverride ?? null,
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
  options?: { departureFactsOverride?: DepartureKeyFacts | null }
): ProductMetaChip[] {
  const headerBadges = buildPublicProductBadges(product)
  const chips: ProductMetaChip[] = [
    { kind: 'optional', value: optionalValue(product, headerBadges) },
    { kind: 'shopping', value: shoppingValue(product, headerBadges) },
    { kind: 'freeTime', value: freeTimeValue(product, headerBadges) },
  ]
  const airline = product.airline?.trim()
  const { routing, hasFlightCtx } = flightRoutingChipArgs(product, options?.departureFactsOverride)

  if (airline) {
    chips.push({ kind: 'airline', value: airline })
    chips.push({ kind: 'flightRouting', value: routing.flightRoutingLabel })
  } else if (
    hasFlightCtx &&
    (routing.source !== 'default' || routing.flightRoutingLabel !== '직항')
  ) {
    chips.push({ kind: 'flightRouting', value: routing.flightRoutingLabel })
  }
  if (product.listingKind === 'air_hotel_free') {
    return chips.filter((c) => c.kind !== 'freeTime')
  }
  return chips
}
