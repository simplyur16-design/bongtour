/**
 * 공개 상세 — 출발 행 상한(100행) 밖에 더 싼 예약가능 출발일이 있으면 그 날짜의 행 전체를 덧붙인다.
 * 같은 날짜에 항공사별 회차가 많은 상품(ybtour 등)은 100행이 첫 며칠에서 끝나
 * 카드 최저가(minBookableAdultPrice, 전 출발 집계)와 상세 기본 출발(로드된 100행 중 최저)이 어긋났다.
 * 읽기 전용(DB 쓰기 없음). 날짜 오름차순 유지 — 덧붙이는 날짜는 항상 로드 범위 뒤.
 */
// REGRESSION-FREEZE[detail-cheapest-date-rows]: 100행 밖 최저가 날짜 행 병합 — 카드 최저가 = 상세 기본 출발
import { prisma } from '@/lib/prisma'
import { buildProductDetailDepartureSelect, DETAIL_DEPARTURE_PER_PRODUCT_TAKE } from '@/lib/product-detail-page-include'

type LiteDeparture = {
  departureDate: Date
  adultPrice: number | null
  isBookable?: boolean | null
  seatCount: number | null
  statusRaw: string | null
}

/** 카드·달력과 같은 취지의 보수적 예약가능 판정 — 가격 있음, 마감·판매완료 아님 */
export function isLiteDepartureBookableForCheapest(d: LiteDeparture): boolean {
  if (d.adultPrice == null || !(d.adultPrice > 0)) return false
  if (d.isBookable === false) return false
  if (d.seatCount === 0) return false
  if (/마감|완료|불가|취소/.test(String(d.statusRaw ?? ''))) return false
  return true
}

export async function withCheapestBookableDateDepartures<
  T extends { id: string; departures?: Array<LiteDeparture & { id: string }> } | null,
>(row: T): Promise<T> {
  if (!row || !Array.isArray(row.departures)) return row
  const loaded = row.departures
  if (loaded.length < DETAIL_DEPARTURE_PER_PRODUCT_TAKE) return row
  const last = loaded[loaded.length - 1]
  if (!last) return row
  const loadedMin = loaded.filter(isLiteDepartureBookableForCheapest).reduce<number | null>(
    (m, d) => (m == null || (d.adultPrice as number) < m ? (d.adultPrice as number) : m),
    null,
  )
  const beyond = await prisma.productDeparture.findMany({
    where: { productId: row.id, departureDate: { gt: last.departureDate } },
    orderBy: [{ adultPrice: 'asc' }, { departureDate: 'asc' }],
    select: { departureDate: true, adultPrice: true, isBookable: true, seatCount: true, statusRaw: true },
  })
  const cheapest = beyond.find(isLiteDepartureBookableForCheapest)
  if (!cheapest || cheapest.adultPrice == null) return row
  if (loadedMin != null && cheapest.adultPrice >= loadedMin) return row
  const sameDate = await prisma.productDeparture.findMany({
    where: { productId: row.id, departureDate: cheapest.departureDate },
    orderBy: { departureDate: 'asc' },
    select: buildProductDetailDepartureSelect(),
  })
  const seen = new Set(loaded.map((d) => d.id))
  const extra = sameDate.filter((d) => !seen.has(d.id))
  if (extra.length === 0) return row
  return { ...row, departures: [...loaded, ...extra] } as T
}
