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
  bookableCompareWeekRows,
  compareWeekEndYmd,
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
import {
  CANONICAL_OVERSEAS_SUPPLIER_KEYS,
  isCanonicalOverseasSupplierKey,
  type CanonicalOverseasSupplierKey,
} from '@/lib/overseas-supplier-canonical-keys'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import { publicProductPath } from '@/lib/product-public-path'
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
  supplierKey: string
  supplierLabel: string
  durationLabel: string
  durationMatch: 'exact' | 'near'
  departureLabel: string
  departureCount: number
  departureSort: string | null
  priceLabel: string
  /** 성인 1인 원화. 표시 금액이 외화여도 차이 계산에만 쓴다. */
  adultKrw: number | null
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
  /** 지금 보는 상품의 가장 가까운 출발 성인 1인 원화 */
  anchorAdultKrw: number | null
  cards: SimilarItineraryDetailCard[]
}

const shelfSelect = {
  id: true,
  slug: true,
  originCode: true,
  title: true,
  originalTitle: true,
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
  originCode: string
  title: string
  originalTitle: string | null
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

export function formatAdultPriceDelta(cardKrw: number | null | undefined, anchorKrw: number | null | undefined): string | null {
  if (cardKrw == null || anchorKrw == null) return null
  if (!Number.isFinite(cardKrw) || !Number.isFinite(anchorKrw) || cardKrw <= 0 || anchorKrw <= 0) return null
  const delta = Math.round(cardKrw) - Math.round(anchorKrw)
  if (delta === 0) return '같은 가격'
  const sign = delta > 0 ? '+' : '-'
  return `${sign}${Math.abs(delta).toLocaleString('ko-KR')}원`
}

const PIN_LABELS = ['같은 일정 최저가', '노쇼핑 최저가', '출발 가장 빠른 상품'] as const

export function pickSimilarListPins<
  T extends {
    id: string
    adultKrw: number | null
    durationMatch: 'exact' | 'near'
    noShopping: boolean
    departureSort: string | null
  },
>(cards: readonly T[]): Array<{ id: string; labels: string[] }> {
  const priced = (list: readonly T[]) => list.filter((card) => card.adultKrw != null && card.adultKrw > 0)
  const cheapest = (list: readonly T[]): T | null => {
    const rows = priced(list)
    if (rows.length === 0) return null
    return rows.reduce((best, cur) => {
      if (cur.adultKrw! < best.adultKrw!) return cur
      if (cur.adultKrw !== best.adultKrw) return best
      const curDate = cur.departureSort ?? '9999-99-99'
      const bestDate = best.departureSort ?? '9999-99-99'
      if (curDate < bestDate) return cur
      if (curDate === bestDate && cur.id < best.id) return cur
      return best
    })
  }
  const picks: Array<{ id: string; label: (typeof PIN_LABELS)[number] }> = []
  const exactLow = cheapest(cards.filter((card) => card.durationMatch === 'exact'))
  if (exactLow) picks.push({ id: exactLow.id, label: '같은 일정 최저가' })
  const noShopLow = cheapest(cards.filter((card) => card.noShopping))
  if (noShopLow) picks.push({ id: noShopLow.id, label: '노쇼핑 최저가' })
  const dated = cards.filter((card) => card.departureSort)
  if (dated.length > 0) {
    const earliest = dated.reduce((best, cur) => {
      if (cur.departureSort! < best.departureSort!) return cur
      if (cur.departureSort !== best.departureSort) return best
      const curPrice = cur.adultKrw ?? Number.POSITIVE_INFINITY
      const bestPrice = best.adultKrw ?? Number.POSITIVE_INFINITY
      if (curPrice < bestPrice) return cur
      if (curPrice === bestPrice && cur.id < best.id) return cur
      return best
    })
    picks.push({ id: earliest.id, label: '출발 가장 빠른 상품' })
  }
  const labelsById = new Map<string, string[]>()
  const order: string[] = []
  for (const pick of picks) {
    if (!labelsById.has(pick.id)) {
      labelsById.set(pick.id, [])
      order.push(pick.id)
    }
    labelsById.get(pick.id)!.push(pick.label)
  }
  return order.map((id) => ({
    id,
    labels: PIN_LABELS.filter((label) => labelsById.get(id)!.includes(label)),
  }))
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

export function productCodeStem(originCode: string | null | undefined): string {
  const raw = String(originCode || '').trim().toUpperCase()
  const date = /2[4-9](?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])/
  const found = date.exec(raw)
  if (!found || found.index <= 0) return raw
  const head = raw.slice(0, found.index).replace(/[-_]+$/g, '')
  return head || raw
}

export function similarGroupTitleKey(title: string | null | undefined): string {
  const display = normalizeSupplierRegisterListingTitle(String(title || '')) || String(title || '').trim()
  return display.toLowerCase().replace(/\s+/g, '')
}

export function similarShelfProductTitle(title: string | null | undefined, originalTitle?: string | null): string {
  const display = normalizeSupplierRegisterListingTitle(String(title || '')) || String(title || '').trim()
  const original = normalizeSupplierRegisterListingTitle(String(originalTitle || '')) || String(originalTitle || '').trim()
  const placeOnly = (value: string) => /^[^\d]{0,16}\d+\s*박\s*\d+\s*일$/.test(value.trim())
  if (display && !placeOnly(display)) return display
  if (original && !placeOnly(original)) return original
  return display || original || '상품'
}

type GroupableShelfItem = {
  supplierKey: string
  originCode: string
  title: string
}

/** 같은 공급사에서 상품코드(날짜 접미 제거)나 제목이 같으면 한 상품. */
export function groupSimilarShelfItems<T extends GroupableShelfItem>(items: readonly T[]): T[][] {
  const parent = items.map((_, i) => i)
  const find = (i: number): number => {
    let x = i
    while (parent[x] !== x) x = parent[x]!
    return x
  }
  const unite = (a: number, b: number) => {
    const pa = find(a)
    const pb = find(b)
    if (pa !== pb) parent[pb] = pa
  }
  const byCode = new Map<string, number>()
  const byTitle = new Map<string, number>()
  items.forEach((item, index) => {
    const supplier = item.supplierKey || 'unknown'
    const code = productCodeStem(item.originCode)
    const titleKey = similarGroupTitleKey(item.title)
    const codeKey = code ? `${supplier}|code|${code}` : ''
    const titleMapKey = titleKey.length >= 8 ? `${supplier}|title|${titleKey}` : ''
    if (codeKey && byCode.has(codeKey)) unite(index, byCode.get(codeKey)!)
    if (titleMapKey && byTitle.has(titleMapKey)) unite(index, byTitle.get(titleMapKey)!)
    if (codeKey) byCode.set(codeKey, index)
    if (titleMapKey) byTitle.set(titleMapKey, index)
  })
  const groups = new Map<number, T[]>()
  items.forEach((item, index) => {
    const root = find(index)
    const list = groups.get(root) ?? []
    list.push(item)
    groups.set(root, list)
  })
  return [...groups.values()]
}

export function interleaveSimilarCardsBySupplier<T extends { supplierKey: string; priceSort: number | null }>(
  cards: readonly T[],
  cap = SIMILAR_DETAIL_CARD_CAP,
): T[] {
  const buckets = new Map<string, T[]>()
  const sorted = [...cards].sort((a, b) => {
    if (a.priceSort == null && b.priceSort == null) return 0
    if (a.priceSort == null) return 1
    if (b.priceSort == null) return -1
    return a.priceSort - b.priceSort
  })
  for (const card of sorted) {
    const list = buckets.get(card.supplierKey) ?? []
    list.push(card)
    buckets.set(card.supplierKey, list)
  }
  const order = [
    ...CANONICAL_OVERSEAS_SUPPLIER_KEYS.filter((key) => buckets.has(key)),
    ...[...buckets.keys()].filter((key) => !CANONICAL_OVERSEAS_SUPPLIER_KEYS.includes(key as CanonicalOverseasSupplierKey)).sort(),
  ]
  const out: T[] = []
  let round = 0
  while (out.length < cap) {
    let added = false
    for (const key of order) {
      const card = buckets.get(key)?.[round]
      if (!card) continue
      out.push(card)
      added = true
      if (out.length >= cap) break
    }
    if (!added) break
    round += 1
  }
  return out
}

function cardTitle(row: ShelfRow): string {
  return similarShelfProductTitle(row.title, row.originalTitle)
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
  const departureSince = new Date(baseDate.getTime() - 2 * 24 * 60 * 60 * 1000)
  const kind = similarItineraryCompareKindFromProduct({
    listingKind: input.listingKind,
    productType: input.productType,
    slug: input.slug,
  })
  const anchor = (await prisma.product.findFirst({
    where: { id: input.id, registrationStatus: 'registered' },
    select: {
      ...shelfSelect,
      departures: {
        ...shelfSelect.departures,
        where: { departureDate: { gte: departureSince } },
      },
    },
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
  const anchorSupplier = normalizeSupplierOrigin(anchor.originSource)
  const anchorCode = productCodeStem(anchor.originCode)
  const anchorTitleKey = similarGroupTitleKey(anchor.title)
  const related = products.filter((p) => {
    const peerPlace = resolveComparePlaceCluster({
      primaryDestination: p.primaryDestination,
      destination: p.destination,
      title: p.title,
    })
    if (!comparePlaceClustersMatch(place, peerPlace)) return false
    const supplier = normalizeSupplierOrigin(p.originSource)
    if (!isCanonicalOverseasSupplierKey(supplier)) return false
    if (!productMatchesSimilarItineraryCompareKind(p, kind)) return false
    if (supplier === anchorSupplier && anchorCode && productCodeStem(p.originCode) === anchorCode) return false
    const titleKey = similarGroupTitleKey(p.title)
    if (supplier === anchorSupplier && anchorTitleKey.length >= 8 && titleKey === anchorTitleKey) return false
    return true
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
  const groups = groupSimilarShelfItems(
    picked.items.map((item) => ({
      ...item,
      supplierKey: normalizeSupplierOrigin(item.row.originSource) || 'unknown',
      originCode: item.row.originCode,
      title: item.row.title,
    })),
  )
  const groupedCards = groups.map((group) => {
    const dates = new Map<string, { row: ShelfRow; adult: number; carrier: string | null }>()
    for (const item of group) {
      for (const dep of bookableCompareWeekRows(toCompareWeekRows(item.row.departures ?? []), baseDate)) {
        const prev = dates.get(dep.date)
        if (!prev || dep.adult < prev.adult) {
          dates.set(dep.date, { row: item.row, adult: dep.adult, carrier: dep.carrierName })
        }
      }
    }
    const ymds = [...dates.keys()].sort()
    const nearestYmd = ymds[0] ?? null
    const nearest = nearestYmd ? dates.get(nearestYmd)! : null
    const lead = nearest?.row ?? group[0]!.row
    const weekEnd = weekStart ? compareWeekEndYmd(weekStart) : null
    const sameWeek = Boolean(weekStart && weekEnd && ymds.some((ymd) => ymd >= weekStart && ymd <= weekEnd))
    return toCard(lead, group.some((item) => item.relation === 'exact') ? 'exact' : 'near', weekStart, baseDate, anchorFacts, {
      dateYmd: nearestYmd,
      adultKrw: nearest?.adult ?? null,
      carrierName: nearest?.carrier ?? null,
      count: ymds.length,
      sameWeek,
    })
  })
  const cards = interleaveSimilarCardsBySupplier(groupedCards)

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
    anchorAdultKrw: nearestBookableAdultKrw(anchor, baseDate),
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

function nearestBookableAdultKrw(row: ShelfRow, baseDate: Date): number | null {
  const bookable = bookableCompareWeekRows(toCompareWeekRows(row.departures ?? []), baseDate)
  const nearest = [...bookable].sort((a, b) => a.date.localeCompare(b.date))[0]
  if (nearest && nearest.adult > 0) return Math.round(nearest.adult)
  if (isKrwCurrency(row.priceCurrency) && row.priceFrom != null && row.priceFrom > 0) return Math.round(row.priceFrom)
  return null
}

function factsFor(
  row: ShelfRow,
  weekStart: string | null,
  baseDate: Date,
  focus?: {
    dateYmd: string | null
    adultKrw: number | null
    carrierName: string | null
    count: number
    sameWeek: boolean
  },
): AnchorFacts & {
  departureLabel: string
  departureCount: number
  departureSort: string | null
  priceSort: number | null
  adultKrw: number | null
  noShopping: boolean
  noTip: boolean
  sameWeek: boolean
  hotelGrade: string
} {
  const weekPick = weekStart ? pickCompareWeekDeparture(toCompareWeekRows(row.departures ?? []), weekStart, baseDate) : null
  const focusedCarrier = focus?.carrierName?.trim() || null
  const weekCarrier = focusedCarrier || weekPick?.carrierName?.trim() || null
  const airlineBase = resolveCompareAirlineLabel({
    airline: row.airline,
    prices: (row.prices ?? []).map((pr) => ({ id: String(pr.id), date: String(pr.date), adult: pr.adult })),
    departures: row.departures,
    baseDate,
  })
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
  const adultKrw = focus ? focus.adultKrw : (weekPick?.adultKrw ?? null)
  const price = shelfPackagePriceLabel({
    adultKrw,
    priceCurrency: row.priceCurrency,
    priceFrom: row.priceFrom,
  })
  const hotelGrade = hotelMeal.hotelStarGrade?.trim() || '정보 없음'
  const dateYmd = focus ? focus.dateYmd : (weekPick?.dateYmd ?? null)
  const count = focus?.count ?? (dateYmd ? 1 : 0)
  const nearestLabel = dateYmd ? formatCompareDayLabel(dateYmd) : '출발일 없음'
  return {
    airline,
    hotel: hotelGrade,
    shopping: shop.label,
    option: optionLabel(row),
    tip: tip.label,
    meal: hotelMeal.mealLabel?.trim() || '정보 없음',
    price: price.label,
    adultKrw: focus?.adultKrw && focus.adultKrw > 0 ? Math.round(focus.adultKrw) : price.sort,
    departureLabel: count > 1 ? `가장 가까운 ${nearestLabel} · 출발일 ${count}개` : nearestLabel,
    departureCount: count,
    departureSort: dateYmd,
    priceSort: price.sort,
    noShopping: shop.noShopping,
    noTip: tip.kind === 'no',
    sameWeek: focus ? focus.sameWeek : weekPick != null,
    hotelGrade,
  }
}

function toCard(
  row: ShelfRow,
  durationMatch: 'exact' | 'near',
  weekStart: string | null,
  baseDate: Date,
  anchor: AnchorFacts,
  focus?: {
    dateYmd: string | null
    adultKrw: number | null
    carrierName: string | null
    count: number
    sameWeek: boolean
  },
): SimilarItineraryDetailCard {
  const facts = factsFor(row, weekStart, baseDate, focus)
  const len = deriveTripNightsDays(lengthInput(row))
  const supplierKey = normalizeSupplierOrigin(row.originSource) || 'unknown'
  return {
    id: row.id,
    href: publicProductPath({ id: row.id, slug: row.slug }),
    title: cardTitle(row),
    supplierKey,
    supplierLabel: formatOriginSourceForDisplay(row.originSource),
    durationLabel: len.label || '정보 없음',
    durationMatch,
    departureLabel: facts.departureLabel,
    departureCount: facts.departureCount,
    departureSort: facts.departureSort,
    priceLabel: facts.price,
    adultKrw: facts.adultKrw,
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
