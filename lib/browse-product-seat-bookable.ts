import {
  isDepartureRowPublicBookable,
  isDepartureSoldOut,
  type DepartureSeatRowLike,
} from '@/lib/departure-seat-availability'
import type { ProductBrowseDepartureRow } from '@/lib/product-browse-full-include'

function browseDepartureSeatRow(d: ProductBrowseDepartureRow): DepartureSeatRowLike {
  return {
    adult: d.adultPrice,
    seatCount: d.seatCount,
    seatsStatusRaw: d.seatsStatusRaw,
    statusRaw: d.statusRaw,
  }
}

/** browse 출발 행 — 잔여석·마감 반영 예약 가능 여부 */
export function isBrowseDeparturePublicBookable(d: ProductBrowseDepartureRow): boolean {
  return isDepartureRowPublicBookable(browseDepartureSeatRow(d))
}

/** browse 출발 행 — 가격 있음 + 잔여석 없음(판매완료) */
export function isBrowseDepartureSoldOutWithPrice(d: ProductBrowseDepartureRow): boolean {
  return isDepartureSoldOut(browseDepartureSeatRow(d))
}

/**
 * 미래(서울+2일) 출발 중 성인가가 있는 날이 하나라도 있고, 전부 판매완료일 때만 true.
 * 가격 없음·출발 없음·좌석 미수집은 판매완료 카드가 아님.
 */
export function isBrowseProductFullySoldOut(departures: ProductBrowseDepartureRow[]): boolean {
  if (departures.length === 0) return false
  const priced = departures.filter((d) => (d.adultPrice ?? 0) > 0)
  if (priced.length === 0) return false
  return priced.every((d) => isBrowseDepartureSoldOutWithPrice(d))
}

/** 잔여석 반영 최저 성인가 — browse 카드·정렬용 */
export function minBrowseBookableAdultPrice(departures: ProductBrowseDepartureRow[]): number | null {
  const prices = departures
    .filter((d) => isBrowseDeparturePublicBookable(d))
    .map((d) => d.adultPrice as number)
  if (prices.length === 0) return null
  return Math.min(...prices)
}
