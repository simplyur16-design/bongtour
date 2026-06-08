/**
 * 향후 6개월(180일) 달력·가격 검증 마커 SSOT.
 *
 * 상품 DB 삭제는 **E2E 배치 또는 라이브 스크래퍼가 6개월 창을 날짜별로 확인했다는
 * 마커가 있을 때만** — 미수집·부분 수집 상품은 대상이 아니다.
 */
import { parseCalendarBatchRetired } from '@/lib/calendar-batch-cursor'
import { addCalendarDaysYmd } from '@/lib/calendar-batch-product-window'
import { CALENDAR_BATCH_HORIZON_DAYS } from '@/lib/calendar-batch-seq-state'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import { seoulCalendarYmd } from '@/lib/scraper-schedule-strategy'

export const SIX_MONTH_PRICE_HORIZON_DAYS = CALENDAR_BATCH_HORIZON_DAYS

export type SixMonthVerificationMarkerSource =
  | 'calendar_batch_retired'
  | 'no_future_departure_confirmed'

export type SixMonthPriceProductLike = {
  rawMeta?: string | null
  noFutureDepartureConfirmedAt?: Date | null
}

export type SixMonthPricedDepartureLike = {
  departureDate: Date | string
  adultPrice?: number | null
}

export type SixMonthVerificationMarker = {
  verified: boolean
  sources: SixMonthVerificationMarkerSource[]
}

/** E2E sequential 배치가 지평선까지 스캔 완료(`calendarBatchRetired`) 또는 라이브 180일 확인(`noFutureDepartureConfirmedAt`). */
export function resolveSixMonthCalendarVerificationMarker(
  product: SixMonthPriceProductLike,
): SixMonthVerificationMarker {
  const sources: SixMonthVerificationMarkerSource[] = []
  if (parseCalendarBatchRetired(product.rawMeta)) {
    sources.push('calendar_batch_retired')
  }
  if (product.noFutureDepartureConfirmedAt != null) {
    sources.push('no_future_departure_confirmed')
  }
  return { verified: sources.length > 0, sources }
}

export function seoulHorizonYmdFromToday(todaySeoulYmd: string = seoulCalendarYmd()): string {
  return addCalendarDaysYmd(todaySeoulYmd, SIX_MONTH_PRICE_HORIZON_DAYS)
}

function departureYmd(d: SixMonthPricedDepartureLike): string | null {
  if (typeof d.departureDate === 'string') {
    const t = d.departureDate.trim().slice(0, 10)
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
  }
  return d.departureDate.toISOString().slice(0, 10)
}

/** 서울 기준 today ~ horizon(포함) 구간에 성인가 > 0 인 출발이 하나라도 있으면 true. */
export function hasPricedDepartureInSeoulWindow(
  departures: readonly SixMonthPricedDepartureLike[],
  todaySeoulYmd: string,
  horizonYmd: string,
): boolean {
  const lo = todaySeoulYmd <= horizonYmd ? todaySeoulYmd : horizonYmd
  const hi = todaySeoulYmd <= horizonYmd ? horizonYmd : todaySeoulYmd
  for (const d of departures) {
    const ymd = departureYmd(d)
    if (ymd == null || ymd < lo || ymd > hi) continue
    const p = d.adultPrice
    if (p != null && Number.isFinite(p) && p > 0) return true
  }
  return false
}

/** 파싱·스크래퍼 입력 행 — Rule A 마커와 동일: 미래 + 성인가 > 0 만 "가격 있는 출발". */
export function hasPricedFutureDepartureInput(
  inputs: readonly { departureDate: string | Date; adultPrice?: number | null }[],
  todayYmd: string,
): boolean {
  for (const x of inputs) {
    const dk = departureInputToYmd(x.departureDate)
    if (dk == null || dk < todayYmd) continue
    const p = x.adultPrice
    if (p != null && Number.isFinite(p) && p > 0) return true
  }
  return false
}

/**
 * 6개월 검증 마커 있음 + 창 내 성인가 있는 출발 없음 → DB 삭제 후보.
 * DB에 가격이 남아 있으면 마커가 있어도 삭제하지 않는다(수동 등록·스테일 마커 방어).
 */
export function isEligibleForSixMonthNoPriceProductPurge(params: {
  product: SixMonthPriceProductLike
  departures: readonly SixMonthPricedDepartureLike[]
  todaySeoulYmd?: string
}): { eligible: boolean; marker: SixMonthVerificationMarker; horizonYmd: string } {
  const todaySeoulYmd = params.todaySeoulYmd ?? seoulCalendarYmd()
  const horizonYmd = seoulHorizonYmdFromToday(todaySeoulYmd)
  const marker = resolveSixMonthCalendarVerificationMarker(params.product)
  if (!marker.verified) {
    return { eligible: false, marker, horizonYmd }
  }
  const hasPrice = hasPricedDepartureInSeoulWindow(params.departures, todaySeoulYmd, horizonYmd)
  return { eligible: !hasPrice, marker, horizonYmd }
}
