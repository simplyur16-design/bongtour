/**
 * 저장 단체번호 달력이 SD1 이거나 과거 출발만 있을 때, 같은 상품의 현재 단체번호를 찾는다.
 * 상품코드(productCode2)·상품명·일정(양쪽 다 있을 때)이 같아야만 그 번호의 공급사 가격을 쓴다.
 * 가격은 후보 번호의 GetOtherDepartureDates 응답만 사용한다.
 *
 * REGRESSION-FREEZE[supplier-sweep-pending-same-event]: SD1·과거만 → 동일 상품 현재 행사 — manifest
 */
import { fetchModetourGroupDetailInfo } from '@/lib/modetour-departures'
import { resolveModetourDetailByOriginCode } from '@/lib/modetour-origin-code-resolve'
import { isModetourAlphaOriginCode } from '@/lib/register-facts/modetour'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import type { DepartureInput } from '@/lib/upsert-product-departures-modetour'

export type ModetourEventIdentity = {
  productNo: string
  productCode2: string | null
  productName: string | null
  /** scheduleItemList 가 있을 때만. 없으면 비교하지 않는다. */
  itineraryKey: string | null
  /** nightCount·dayCount 가 둘 다 있을 때만. */
  durationKey: string | null
}

export type ModetourSameProductRejectReason =
  | 'missing_product_code2'
  | 'product_code2_mismatch'
  | 'missing_product_name'
  | 'product_name_mismatch'
  | 'itinerary_mismatch'
  | 'duration_mismatch'
  | 'same_event_number'

export function modetourNormalizeIdentityText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

export function modetourDetailIdentityName(detail: Record<string, unknown> | null | undefined): string | null {
  if (!detail) return null
  const name = modetourNormalizeIdentityText(String(detail.groupName ?? detail.productName ?? ''))
  return name || null
}

export function modetourDetailItineraryKey(detail: Record<string, unknown> | null | undefined): string | null {
  if (!detail) return null
  const list = detail.scheduleItemList
  if (!Array.isArray(list) || list.length === 0) return null
  const parts: string[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') return null
    const row = item as Record<string, unknown>
    const day = String(row.dayNo ?? row.day ?? '').trim()
    const title = modetourNormalizeIdentityText(String(row.title ?? row.scheduleTitle ?? row.placeName ?? ''))
    if (!day || !title) return null
    parts.push(`${day}:${title}`)
  }
  return parts.join('|')
}

export function modetourDetailDurationKey(detail: Record<string, unknown> | null | undefined): string | null {
  if (!detail) return null
  const nights = Number(detail.nightCount)
  const days = Number(detail.dayCount)
  if (!Number.isFinite(nights) || !Number.isFinite(days)) return null
  return `${nights}n${days}d`
}

export function modetourEventIdentityFromDetail(
  productNo: string,
  detail: Record<string, unknown> | null | undefined,
): ModetourEventIdentity {
  const code2 = String(detail?.productCode2 ?? '').trim()
  return {
    productNo,
    productCode2: isModetourAlphaOriginCode(code2) ? code2 : null,
    productName: modetourDetailIdentityName(detail),
    itineraryKey: modetourDetailItineraryKey(detail),
    durationKey: modetourDetailDurationKey(detail),
  }
}

/** 같은 상품인지. 코드·이름이 없거나 다르면 실패. 일정·박일은 양쪽에 있을 때만 비교. */
export function verifyModetourSameProductEvent(
  stored: ModetourEventIdentity,
  candidate: ModetourEventIdentity,
): { ok: true } | { ok: false; reason: ModetourSameProductRejectReason } {
  if (!stored.productCode2 || !candidate.productCode2) {
    return { ok: false, reason: 'missing_product_code2' }
  }
  if (stored.productCode2 !== candidate.productCode2) {
    return { ok: false, reason: 'product_code2_mismatch' }
  }
  if (!stored.productName || !candidate.productName) {
    return { ok: false, reason: 'missing_product_name' }
  }
  if (stored.productName !== candidate.productName) {
    return { ok: false, reason: 'product_name_mismatch' }
  }
  if (stored.itineraryKey && candidate.itineraryKey && stored.itineraryKey !== candidate.itineraryKey) {
    return { ok: false, reason: 'itinerary_mismatch' }
  }
  if (stored.durationKey && candidate.durationKey && stored.durationKey !== candidate.durationKey) {
    return { ok: false, reason: 'duration_mismatch' }
  }
  if (!candidate.productNo || candidate.productNo === stored.productNo) {
    return { ok: false, reason: 'same_event_number' }
  }
  return { ok: true }
}

/**
 * 단일 출발 상품은 제외. SD1 이거나, 응답 날짜가 있는데 전부 창 시작보다 과거일 때만.
 * 날짜가 아예 없는 빈 달력은 기존 E2E 경로를 유지한다.
 */
export function modetourCalendarNeedsSameProductLookup(args: {
  singleDeparture: boolean
  sd1: boolean
  departureDates: readonly string[]
  windowStartYmd: string
}): boolean {
  if (args.singleDeparture) return false
  if (args.sd1) return true
  if (args.departureDates.length === 0) return false
  return args.departureDates.every((d) => d < args.windowStartYmd)
}

export type ModetourSameProductCalendar = {
  inputs: DepartureInput[]
  sd1: boolean
}

export type ModetourSameProductLookupDeps = {
  fetchDetail: (productNo: string) => Promise<Record<string, unknown> | null>
  resolveCurrentProductNo: (productCode2: string) => Promise<string | null>
  fetchCalendar: (productNo: string) => Promise<ModetourSameProductCalendar>
  logSkip?: (reason: string, extra: Record<string, unknown>) => void
}

export type ModetourSameProductEventHit = {
  productNo: string
  detailUrl: string
  inputs: DepartureInput[]
  sourceDates: string[]
}

function defaultLogSkip(reason: string, extra: Record<string, unknown>): void {
  console.warn('[modetour-same-product-event] skip', { reason, ...extra })
}

function windowBounds(fromYmd: string, toYmd: string): { lo: string; hi: string } {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  return { lo, hi }
}

function pricedInWindow(inputs: DepartureInput[], fromYmd: string, toYmd: string): DepartureInput[] {
  const { lo, hi } = windowBounds(fromYmd, toYmd)
  return inputs.filter((x) => {
    const dk = departureInputToYmd(x.departureDate)
    const price = x.adultPrice
    return dk != null && dk >= lo && dk <= hi && price != null && Number.isFinite(price) && price > 0
  })
}

function calendarDates(inputs: DepartureInput[]): string[] {
  const out: string[] = []
  for (const row of inputs) {
    const dk = departureInputToYmd(row.departureDate)
    if (dk) out.push(dk)
  }
  return out
}

async function defaultFetchDetail(productNo: string): Promise<Record<string, unknown> | null> {
  return fetchModetourGroupDetailInfo(`https://www.modetour.com/package/${productNo}`)
}

async function defaultResolveCurrentProductNo(productCode2: string): Promise<string | null> {
  const resolved = await resolveModetourDetailByOriginCode(productCode2)
  const no = resolved.productNo?.trim() || ''
  if (!no || no === '0') return null
  return no
}

export async function lookupModetourSameProductFutureDepartures(args: {
  storedProductNo: string
  fromYmd: string
  toYmd: string
  deps?: Partial<ModetourSameProductLookupDeps>
}): Promise<ModetourSameProductEventHit | null> {
  const storedProductNo = args.storedProductNo.trim()
  if (!storedProductNo || storedProductNo === '0') return null
  const logSkip = args.deps?.logSkip ?? defaultLogSkip
  const fetchDetail = args.deps?.fetchDetail ?? defaultFetchDetail
  const resolveCurrentProductNo = args.deps?.resolveCurrentProductNo ?? defaultResolveCurrentProductNo
  const fetchCalendar = args.deps?.fetchCalendar
  if (!fetchCalendar) {
    logSkip('missing_calendar_reader', { storedProductNo })
    return null
  }

  let storedDetail: Record<string, unknown> | null = null
  try {
    storedDetail = await fetchDetail(storedProductNo)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logSkip('stored_detail_unavailable', { storedProductNo, message: message.slice(0, 200) })
    return null
  }
  const stored = modetourEventIdentityFromDetail(storedProductNo, storedDetail)
  if (!stored.productCode2 || !stored.productName) {
    logSkip(stored.productCode2 ? 'missing_product_name' : 'missing_product_code2', {
      storedProductNo,
      productCode2: stored.productCode2,
    })
    return null
  }

  let candidateNo: string | null = null
  try {
    candidateNo = await resolveCurrentProductNo(stored.productCode2)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logSkip('resolve_failed', { storedProductNo, productCode2: stored.productCode2, message: message.slice(0, 200) })
    return null
  }
  if (!candidateNo || candidateNo === storedProductNo) {
    logSkip('no_other_event', { storedProductNo, productCode2: stored.productCode2, candidateNo })
    return null
  }

  let candidateDetail: Record<string, unknown> | null = null
  try {
    candidateDetail = await fetchDetail(candidateNo)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logSkip('candidate_detail_unavailable', { storedProductNo, candidateNo, message: message.slice(0, 200) })
    return null
  }
  const candidate = modetourEventIdentityFromDetail(candidateNo, candidateDetail)
  const same = verifyModetourSameProductEvent(stored, candidate)
  if (!same.ok) {
    logSkip(same.reason, {
      storedProductNo,
      candidateNo,
      storedProductCode2: stored.productCode2,
      candidateProductCode2: candidate.productCode2,
    })
    return null
  }

  let calendar: ModetourSameProductCalendar
  try {
    calendar = await fetchCalendar(candidateNo)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logSkip('candidate_calendar_error', { storedProductNo, candidateNo, message: message.slice(0, 200) })
    return null
  }
  if (calendar.sd1) {
    logSkip('candidate_sd1', { storedProductNo, candidateNo, productCode2: stored.productCode2 })
    return null
  }
  const dates = calendarDates(calendar.inputs)
  const { lo } = windowBounds(args.fromYmd, args.toYmd)
  if (dates.length > 0 && dates.every((d) => d < lo)) {
    logSkip('candidate_only_past', { storedProductNo, candidateNo, productCode2: stored.productCode2 })
    return null
  }
  const inputs = pricedInWindow(calendar.inputs, args.fromYmd, args.toYmd)
  if (inputs.length === 0) {
    logSkip('candidate_no_future_price', { storedProductNo, candidateNo, productCode2: stored.productCode2 })
    return null
  }
  const sourceDates = [
    ...new Set(inputs.map((x) => departureInputToYmd(x.departureDate)).filter((d): d is string => d != null)),
  ]
  return {
    productNo: candidateNo,
    detailUrl: `https://www.modetour.com/package/${candidateNo}`,
    inputs,
    sourceDates,
  }
}
