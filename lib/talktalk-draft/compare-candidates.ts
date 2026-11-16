/**
 * 톡톡 상담 초안용 등록 상품 후보.
 * 같은 출발 주간·예약가능 최저가는 `similar-itinerary-compare-week`를 그대로 쓴다.
 * 가격·출발일·잔여석은 넘긴 출발 행의 저장값만 표시한다.
 */
import { publicProductPath } from '@/lib/product-public-path'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { isCanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import {
  comparePlaceClustersMatch,
  compareProductTripLengths,
  resolveComparePlaceCluster,
} from '@/lib/similar-itinerary-compare-cluster'
import {
  listCompareWeekOptions,
  parseCompareWeekParam,
  pickCompareWeekDeparture,
  resolveSelectedCompareWeek,
  toCompareWeekRows,
  type CompareWeekDepartureInput,
} from '@/lib/similar-itinerary-compare-week'

export type TalktalkCompareProductInput = {
  id: string
  title: string
  slug?: string | null
  originSource?: string | null
  primaryDestination?: string | null
  destination?: string | null
  duration?: string | null
  tripNights?: number | null
  tripDays?: number | null
  departures: readonly CompareWeekDepartureInput[]
}

export type TalktalkCompareCandidate = {
  productId: string
  title: string
  href: string
  supplierKey: string
  supplierLabel: string
  departureDate: string
  priceLabel: string
  seatsLabel: string
  adultKrw: number | null
  seatCount: number | null
}

export type TalktalkComparePickResult = {
  placeLabel: string | null
  weekStartYmd: string | null
  /** 요청 주간에 예약가능 출발이 없어 비교 로직의 가장 가까운 주로 옮긴 경우 */
  weekFellBack: boolean
  candidates: TalktalkCompareCandidate[]
}

const INQUIRY_LABEL = '문의'

export function formatStoredAdultPriceLabel(adultKrw: number | null | undefined): string {
  if (adultKrw == null || !Number.isFinite(adultKrw) || adultKrw <= 0) return INQUIRY_LABEL
  return `${Math.round(adultKrw).toLocaleString('ko-KR')}원`
}

export function formatStoredSeatLabel(seatCount: number | null | undefined): string {
  if (typeof seatCount !== 'number' || !Number.isFinite(seatCount)) return INQUIRY_LABEL
  return String(Math.trunc(seatCount))
}

function seatCountOfPick(
  departures: readonly CompareWeekDepartureInput[],
  departureId: string,
): number | null {
  const row = departures.find((d) => String(d.id) === departureId)
  const n = row?.seatCount
  return typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : null
}

/**
 * 목적지 클러스터가 같고, 고른 주에 예약가능 출발이 있는 등록 상품 중 2~3개.
 * 공급사가 다르면 그 공급사를 먼저 고르고, 예산·인원은 저장된 성인가·잔여석과만 비교한다.
 */
export function pickTalktalkCompareCandidates(input: {
  destination: string
  departureDate?: string | null
  budgetKrw?: number | null
  partySize?: number | null
  duration?: string | null
  products: readonly TalktalkCompareProductInput[]
  baseDate?: Date
}): TalktalkComparePickResult {
  const baseDate = input.baseDate ?? new Date()
  const placeWant = resolveComparePlaceCluster({ placeQuery: input.destination })
  if (!placeWant) {
    return { placeLabel: null, weekStartYmd: null, weekFellBack: false, candidates: [] }
  }

  const durationWant = String(input.duration ?? '').trim()
  const matched = input.products.filter((p) => {
    const origin = normalizeSupplierOrigin(p.originSource)
    if (!isCanonicalOverseasSupplierKey(origin)) return false
    const place = resolveComparePlaceCluster({
      primaryDestination: p.primaryDestination,
      destination: p.destination,
      title: p.title,
    })
    if (!comparePlaceClustersMatch(placeWant, place)) return false
    if (!durationWant) return true
    return compareProductTripLengths(
      {
        duration: p.duration,
        title: p.title,
        tripNights: p.tripNights,
        tripDays: p.tripDays,
      },
      { duration: durationWant, title: null },
    )
  })

  const weekRows = matched.map((p) => ({
    id: p.id,
    supplierKey: normalizeSupplierOrigin(p.originSource),
    rows: toCompareWeekRows(p.departures),
    product: p,
  }))
  const options = listCompareWeekOptions(weekRows, baseDate)
  const requested = parseCompareWeekParam(input.departureDate)
  const selected = resolveSelectedCompareWeek(requested, options)
  const weekFellBack = Boolean(requested && selected && requested !== selected)
  if (!selected) {
    return { placeLabel: placeWant.label, weekStartYmd: null, weekFellBack: false, candidates: [] }
  }

  const budget = typeof input.budgetKrw === 'number' && input.budgetKrw > 0 ? Math.round(input.budgetKrw) : null
  const party = typeof input.partySize === 'number' && input.partySize > 0 ? Math.trunc(input.partySize) : null

  const ranked: TalktalkCompareCandidate[] = []
  for (const row of weekRows) {
    const pick = pickCompareWeekDeparture(row.rows, selected, baseDate)
    if (!pick) continue
    if (budget != null && pick.adultKrw > budget) continue
    const seatCount = seatCountOfPick(row.product.departures, pick.departureId)
    if (party != null && seatCount != null && seatCount < party) continue
    const supplierKey = normalizeSupplierOrigin(row.product.originSource)
    ranked.push({
      productId: row.product.id,
      title: String(row.product.title || '').trim() || '(제목 없음)',
      href: publicProductPath({ id: row.product.id, slug: row.product.slug }),
      supplierKey,
      supplierLabel: formatOriginSourceForDisplay(row.product.originSource),
      departureDate: pick.dateYmd,
      priceLabel: formatStoredAdultPriceLabel(pick.adultKrw),
      seatsLabel: formatStoredSeatLabel(seatCount),
      adultKrw: pick.adultKrw,
      seatCount,
    })
  }

  ranked.sort((a, b) => {
    const pa = a.adultKrw ?? Number.MAX_SAFE_INTEGER
    const pb = b.adultKrw ?? Number.MAX_SAFE_INTEGER
    if (pa !== pb) return pa - pb
    return a.departureDate.localeCompare(b.departureDate) || a.productId.localeCompare(b.productId)
  })

  const picked: TalktalkCompareCandidate[] = []
  const seenSupplier = new Set<string>()
  for (const item of ranked) {
    if (seenSupplier.has(item.supplierKey)) continue
    picked.push(item)
    seenSupplier.add(item.supplierKey)
    if (picked.length === 3) break
  }
  if (picked.length < 2) {
    for (const item of ranked) {
      if (picked.some((p) => p.productId === item.productId)) continue
      picked.push(item)
      if (picked.length === 3) break
    }
  }

  return {
    placeLabel: placeWant.label,
    weekStartYmd: selected,
    weekFellBack,
    candidates: picked,
  }
}
