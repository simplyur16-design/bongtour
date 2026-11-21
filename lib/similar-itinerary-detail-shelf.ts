/**
 * 상품 상세 「비슷한 일정 상품」.
 * 도시·박일 매칭과 주간 출발은 비슷한 일정 비교(PR141)·항공사 표시(PR142)와 같은 함수를 쓴다.
 * 같은 기간이 적으면 여행 일수 ±1일만 넓힌다.
 */
import { prisma } from '@/lib/prisma'
import {
  deriveTripNightsDays,
  compareTripLengthMatch,
  type DeriveTripNightsDaysInput,
} from '@/lib/derive-trip-nights-days'
import {
  comparePlaceClustersMatch,
  comparePlaceDbSearchTerms,
  resolveComparePlaceCluster,
} from '@/lib/similar-itinerary-compare-cluster'
import {
  productMatchesSimilarItineraryCompareKind,
  prismaWhereForSimilarItineraryCompareKind,
} from '@/lib/similar-itinerary-compare-kind'
import {
  buildSimilarItineraryCompareHrefFromProduct,
  similarItineraryCompareKindFromProduct,
} from '@/lib/similar-itinerary-compare-href'
import {
  formatCompareDayLabel,
  formatCompareWeekLabel,
  formatCompareWeekPriceLabel,
  listCompareWeekOptions,
  pickCompareWeekDeparture,
  resolveSelectedCompareWeek,
  toCompareWeekRows,
} from '@/lib/similar-itinerary-compare-week'
import { resolveCompareAirlineLabel } from '@/lib/dev-similar-itinerary-compare'
import { deriveAirlineFact } from '@/lib/supplier-product-fact-ssot'
import {
  deriveHotelMealFact,
  deriveOptionalFact,
  deriveShoppingFact,
} from '@/lib/supplier-product-fact-ssot'
import { formatStoredMoneyLabel } from '@/lib/optional-tours-ui-model'
import {
  formatOptionalTourFeeCellForPublicTable,
  parseOptionalToursForPackagePublicTable,
} from '@/lib/optional-tours-ui-model'
import { isCanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import { publicProductPath } from '@/lib/product-public-path'
import { resolvePublicBrowseCardTitle } from '@/lib/bongtour-product-display-title-ssot'
import { normalizeSupplierRegisterListingTitle } from '@/lib/supplier-product-title-display'

export const SIMILAR_DETAIL_EXACT_MIN = 4
export const SIMILAR_DETAIL_CARD_CAP = 12

export type SimilarTripRelation = 'exact' | 'near' | 'far'

export type SimilarItineraryDetailDiffs = {
  airline: boolean
  hotel: boolean
  shopping: boolean
  option: boolean
  tip: boolean
  meal: boolean
  price: boolean
}

export type SimilarItineraryDetailCard = {
  id: string
  href: string
  title: string
  supplierLabel: string
  durationLabel: string
  durationMatch: 'exact' | 'near'
  departureLabel: string
  departureSort: string | null
  priceLabel: string
  priceSort: number | null
  airlineLabel: string
  hotelGradeLabel: string
  shoppingLabel: string
  optionLabel: string
  tipLabel: string
  mealLabel: string
  noShopping: boolean
  noTip: boolean
  sameWeek: boolean
  differs: SimilarItineraryDetailDiffs
}

export type SimilarItineraryDetailShelf = {
  placeLabel: string
  durationLabel: string
  widened: boolean
  weekLabel: string | null
  compareHref: string | null
  cards: SimilarItineraryDetailCard[]
}

const shelfSelect = {
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
  priceCurrency: true,
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
  prices: {
    select: { id: true, date: true, adult: true },
    take: 20,
    orderBy: { date: 'asc' as const },
  },
  departures: {
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
    orderBy: { departureDate: 'asc' as const },
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
    orderBy: { day: 'asc' as const },
    take: 10,
  },
} as const

type ShelfRow = {
  id: string
  slug: string | null
  title: string
  duration: string | null
  tripNights: number | null
  tripDays: number | null
  primaryDestination: string | null
  destination: string | null
  listingKind: string | null
  productType: string | null
  originSource: string | null
  airline: string | null
  priceFrom: number | null
  priceCurrency: string | null
  shoppingCount: number | null
  shoppingVisitCountTotal: number | null
  shoppingShopOptions: string | null
  shoppingItems: string | null
  shoppingCustomsNoticeRaw: string | null
  hasOptionalTours: boolean | null
  optionalToursStructured: string | null
  hotelSummaryText: string | null
  hotelSummaryRaw: string | null
  includedText: string | null
  excludedText: string | null
  rawMeta: string | null
  prices: Array<{ id: string; date: Date | string; adult: number | null }>
  departures: Array<{
    id: string
    adultPrice: number | null
    departureDate: Date | string
    carrierName: string | null
    statusRaw: string | null
    seatsStatusRaw: string | null
    seatCount: number | null
    isBookable: boolean | null
  }>
  itineraryDays: Array<{
    day: number
    hotelText: string | null
    mealSummaryText: string | null
    meals: string | null
    breakfastText: string | null
    lunchText: string | null
    dinnerText: string | null
  }>
}

export function similarTripLengthRelation(
  anchor: DeriveTripNightsDaysInput,
  candidate: DeriveTripNightsDaysInput,
): SimilarTripRelation {
  if (compareTripLengthMatch(anchor, candidate)) return 'exact'
  const a = deriveTripNightsDays(anchor)
  const b = deriveTripNightsDays(candidate)
  if (a.tripDays == null || b.tripDays == null) return 'far'
  if (Math.abs(a.tripDays - b.tripDays) !== 1) return 'far'
  const aN = a.tripNights != null
  const bN = b.tripNights != null
  if (aN !== bN) return 'far'
  if (a.tripNights != null && b.tripNights != null && Math.abs(a.tripNights - b.tripNights) > 1) {
    return 'far'
  }
  return 'near'
}

export function selectSimilarDetailPeers<T extends { relation: SimilarTripRelation }>(
  peers: readonly T[],
  minExact = SIMILAR_DETAIL_EXACT_MIN,
): { items: T[]; widened: boolean } {
  const exact = peers.filter((p) => p.relation === 'exact')
  if (exact.length >= minExact) return { items: exact, widened: false }
  const near = peers.filter((p) => p.relation === 'near')
  return { items: [...exact, ...near], widened: near.length > 0 }
}

function isKrwCurrency(currency: string | null | undefined): boolean {
  const t = String(currency ?? '').trim()
  if (!t) return true
  return /^(KRW|원|￦|WON|₩|원화)$/i.test(t)
}

export function shelfPackagePriceLabel(input: {
  adultKrw: number | null
  priceCurrency: string | null
  priceFrom: number | null
}): { label: string; sort: number | null } {
  if (!isKrwCurrency(input.priceCurrency)) {
    const amount = input.priceFrom != null && input.priceFrom > 0 ? input.priceFrom : null
    if (amount == null) return { label: '정보 없음', sort: null }
    return { label: formatStoredMoneyLabel(amount, input.priceCurrency), sort: null }
  }
  if (input.adultKrw != null && input.adultKrw > 0) {
    return { label: formatCompareWeekPriceLabel(input.adultKrw), sort: Math.round(input.adultKrw) }
  }
  return { label: '정보 없음', sort: null }
}

const NO_TIP_RE = /노\s*팁|NO\s*팁|팁\s*(?:없음|무|불포함)|팁\s*제외/i
const TIP_LINE_RE = /(?:가이드|기사|매너)\s*팁|팁\s*[:：]/i

export function deriveShelfTip(parts: Array<string | null | undefined>): {
  kind: 'yes' | 'no' | 'unknown'
  label: string
} {
  const text = parts.map((p) => String(p ?? '')).join('\n')
  if (NO_TIP_RE.test(text)) return { kind: 'no', label: '노팁' }
  const line = text
    .split(/\n/)
    .map((s) => s.trim())
    .find((s) => s.length > 0 && s.length <= 80 && TIP_LINE_RE.test(s))
  if (line) return { kind: 'yes', label: line.slice(0, 48) }
  if (/팁/.test(text)) return { kind: 'yes', label: '팁 있음' }
  return { kind: 'unknown', label: '정보 없음' }
}

function knownDiff(a: string, b: string): boolean {
  const left = a.trim()
  const right = b.trim()
  if (!left || !right) return false
  if (left === '정보 없음' || right === '정보 없음') return false
  if (left === '이 주 출발 없음' || right === '이 주 출발 없음') return false
  return left !== right
}

function shoppingLabel(row: ShelfRow): { label: string; noShopping: boolean } {
  const fact = deriveShoppingFact(row)
  if (fact.state === 'no') return { label: '노쇼핑', noShopping: true }
  if (fact.state === 'yes' && fact.visitCount != null && fact.visitCount > 0) {
    return { label: `쇼핑 ${fact.visitCount}회`, noShopping: false }
  }
  if (fact.state === 'yes') return { label: '쇼핑 있음', noShopping: false }
  return { label: '정보 없음', noShopping: false }
}

function optionLabel(row: ShelfRow): string {
  const fact = deriveOptionalFact(row)
  if (fact.state === 'no') return '노옵션'
  const fee = parseOptionalToursForPackagePublicTable(row.optionalToursStructured)
    .map((r) => formatOptionalTourFeeCellForPublicTable(r))
    .find((label) => label && label !== '문의')
  if (fact.state === 'yes') {
    const count = fact.rowCount > 0 ? `${fact.rowCount}개` : '있음'
    return fee ? `옵션 ${count} · ${fee}` : `옵션 ${count}`
  }
  return '정보 없음'
}

function cardTitle(row: ShelfRow): string {
  const planB =
    normalizeSupplierRegisterListingTitle(String(row.title || '')) ||
    String(row.title || '').trim() ||
    '상품'
  return (
    resolvePublicBrowseCardTitle(
      {
        title: row.title,
        duration: row.duration,
        primaryDestination: row.primaryDestination,
        destination: row.destination,
      },
      planB,
    ).cardTitle || planB
  )
}

function lengthInput(row: Pick<ShelfRow, 'duration' | 'title' | 'tripNights' | 'tripDays' | 'itineraryDays'>): DeriveTripNightsDaysInput {
  return {
    duration: row.duration,
    title: row.title,
    tripNights: row.tripNights,
    tripDays: row.tripDays,
    scheduleDayCount: row.itineraryDays?.length ?? null,
  }
}

export async function loadSimilarItineraryDetailShelf(input: {
  id: string
  slug?: string | null
  listingKind?: string | null
  productType?: string | null
  baseDate?: Date
}): Promise<SimilarItineraryDetailShelf | null> {
  const baseDate = input.baseDate ?? new Date()
  const kind = similarItineraryCompareKindFromProduct({
    listingKind: input.listingKind,
    productType: input.productType,
    slug: input.slug,
  })
  const anchor = (await prisma.product.findFirst({
    where: { id: input.id, registrationStatus: 'registered' },
    select: shelfSelect,
  })) as ShelfRow | null
  if (!anchor) return null

  const place = resolveComparePlaceCluster({
    primaryDestination: anchor.primaryDestination,
    destination: anchor.destination,
    title: anchor.title,
  })
  const durationLabel = deriveTripNightsDays(lengthInput(anchor)).label
  if (!place || !durationLabel) return null

  const placeTerms = comparePlaceDbSearchTerms(place)
  if (placeTerms.length === 0) return null
  const departureSince = new Date(baseDate.getTime() - 2 * 24 * 60 * 60 * 1000)
  const products = (await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      travelScope: 'overseas',
      id: { not: anchor.id },
      OR: placeTerms.flatMap((t) => [
        { primaryDestination: { contains: t } },
        { destination: { contains: t } },
        { title: { contains: t } },
      ]),
      AND: [prismaWhereForSimilarItineraryCompareKind(kind)],
      departures: { some: { departureDate: { gte: departureSince } } },
    },
    take: 400,
    select: {
      ...shelfSelect,
      departures: {
        ...shelfSelect.departures,
        where: { departureDate: { gte: departureSince } },
      },
    },
  })) as ShelfRow[]

  const anchorLen = lengthInput(anchor)
  const related = products.filter((p) => {
    const peerPlace = resolveComparePlaceCluster({
      primaryDestination: p.primaryDestination,
      destination: p.destination,
      title: p.title,
    })
    if (!comparePlaceClustersMatch(place, peerPlace)) return false
    if (!isCanonicalOverseasSupplierKey(normalizeSupplierOrigin(p.originSource))) return false
    return productMatchesSimilarItineraryCompareKind(p, kind)
  })
  const withRelation = related.map((row) => ({
    row,
    relation: similarTripLengthRelation(anchorLen, lengthInput(row)),
  }))
  const picked = selectSimilarDetailPeers(withRelation.filter((x) => x.relation !== 'far'))
  if (picked.items.length === 0) return null

  const weekRows = new Map(
    picked.items.map((item) => [item.row.id, toCompareWeekRows(item.row.departures ?? [])]),
  )
  const weekOptions = listCompareWeekOptions(
    picked.items.map((item) => ({
      id: item.row.id,
      supplierKey: normalizeSupplierOrigin(item.row.originSource),
      rows: weekRows.get(item.row.id) ?? [],
    })),
    baseDate,
  )
  const weekStart = resolveSelectedCompareWeek(null, weekOptions)

  const anchorFacts = factsFor(anchor, weekStart, baseDate)
  const cards = picked.items
    .map((item) => toCard(item.row, item.relation === 'near' ? 'near' : 'exact', weekStart, baseDate, anchorFacts))
    .sort((a, b) => {
      if (a.priceSort == null && b.priceSort == null) return a.supplierLabel.localeCompare(b.supplierLabel, 'ko')
      if (a.priceSort == null) return 1
      if (b.priceSort == null) return -1
      return a.priceSort - b.priceSort
    })
    .slice(0, SIMILAR_DETAIL_CARD_CAP)

  if (cards.length === 0) return null
  return {
    placeLabel: place.label,
    durationLabel,
    widened: picked.widened,
    weekLabel: weekStart ? formatCompareWeekLabel(weekStart) : null,
    compareHref: buildSimilarItineraryCompareHrefFromProduct({
      primaryDestination: anchor.primaryDestination,
      destination: anchor.destination,
      duration: anchor.duration,
      title: anchor.title,
      listingKind: anchor.listingKind,
      productType: anchor.productType,
      slug: anchor.slug ?? input.slug,
      totalDays: anchor.tripDays,
    }),
    cards,
  }
}

type AnchorFacts = {
  airline: string
  hotel: string
  shopping: string
  option: string
  tip: string
  meal: string
  price: string
}

function factsFor(row: ShelfRow, weekStart: string | null, baseDate: Date): AnchorFacts & {
  departureLabel: string
  departureSort: string | null
  priceSort: number | null
  noShopping: boolean
  noTip: boolean
  sameWeek: boolean
  hotelGrade: string
} {
  const weekPick = weekStart ? pickCompareWeekDeparture(toCompareWeekRows(row.departures ?? []), weekStart, baseDate) : null
  const airlineBase = resolveCompareAirlineLabel({
    airline: row.airline,
    prices: (row.prices ?? []).map((pr) => ({ id: String(pr.id), date: String(pr.date), adult: pr.adult })),
    departures: row.departures,
    baseDate,
  })
  const weekCarrier = weekPick?.carrierName?.trim() || null
  const airline = weekCarrier
    ? deriveAirlineFact({
        departureKeyFactsAirline: weekCarrier,
        selectedDepartureCarrierName: weekCarrier,
        rawMeta: null,
      }).airlineLabel
    : airlineBase
  const hotelMeal = deriveHotelMealFact({
    ...row,
    listingKind: row.listingKind,
    productType: row.productType,
    slug: row.slug,
  })
  const shop = shoppingLabel(row)
  const tip = deriveShelfTip([row.title, row.includedText, row.excludedText])
  const price = shelfPackagePriceLabel({
    adultKrw: weekPick?.adultKrw ?? null,
    priceCurrency: row.priceCurrency,
    priceFrom: row.priceFrom,
  })
  const hotelGrade = hotelMeal.hotelStarGrade?.trim() || '정보 없음'
  return {
    airline,
    hotel: hotelGrade,
    shopping: shop.label,
    option: optionLabel(row),
    tip: tip.label,
    meal: hotelMeal.mealLabel?.trim() || '정보 없음',
    price: price.label,
    departureLabel: weekPick ? formatCompareDayLabel(weekPick.dateYmd) : '출발일 없음',
    departureSort: weekPick?.dateYmd ?? null,
    priceSort: price.sort,
    noShopping: shop.noShopping,
    noTip: tip.kind === 'no',
    sameWeek: weekPick != null,
    hotelGrade,
  }
}

function toCard(
  row: ShelfRow,
  durationMatch: 'exact' | 'near',
  weekStart: string | null,
  baseDate: Date,
  anchor: AnchorFacts,
): SimilarItineraryDetailCard {
  const facts = factsFor(row, weekStart, baseDate)
  const len = deriveTripNightsDays(lengthInput(row))
  return {
    id: row.id,
    href: publicProductPath({ id: row.id, slug: row.slug }),
    title: cardTitle(row),
    supplierLabel: formatOriginSourceForDisplay(row.originSource),
    durationLabel: len.label || '정보 없음',
    durationMatch,
    departureLabel: facts.departureLabel,
    departureSort: facts.departureSort,
    priceLabel: facts.price,
    priceSort: facts.priceSort,
    airlineLabel: facts.airline,
    hotelGradeLabel: facts.hotel,
    shoppingLabel: facts.shopping,
    optionLabel: facts.option,
    tipLabel: facts.tip,
    mealLabel: facts.meal,
    noShopping: facts.noShopping,
    noTip: facts.noTip,
    sameWeek: facts.sameWeek,
    differs: {
      airline: knownDiff(anchor.airline, facts.airline),
      hotel: knownDiff(anchor.hotel, facts.hotel),
      shopping: knownDiff(anchor.shopping, facts.shopping),
      option: knownDiff(anchor.option, facts.option),
      tip: knownDiff(anchor.tip, facts.tip),
      meal: knownDiff(anchor.meal, facts.meal),
      price: knownDiff(anchor.price, facts.price),
    },
  }
}
