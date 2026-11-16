/**
 * 카드 최저가 — 미래 출발(오늘 KST 이후) 전체를 DB에서 집계한다.
 * 날짜순 take 로 자른 행의 최저가를 쓰지 않는다.
 * 판매가능 조건은 상세 기본 출발과 같다(isDepartureRowPublicBookable).
 * REGRESSION-FREEZE[card-min-price-beyond-row-cap]: 80행 밖 최저가도 카드에 반영 — manifest
 */
import { Prisma } from '@prisma/client'
import { isDepartureRowPublicBookable } from '@/lib/departure-seat-availability'
import { prisma } from '@/lib/prisma'

export type CardFutureDeparturePriceRow = {
  adultPrice: number | null
  departureDate: Date
  isBookable?: boolean | null
  seatCount?: number | null
  seatsStatusRaw?: string | null
  statusRaw?: string | null
}

/** 카드 가격 하한 — 기존 시즌·해외 섹션 startOfTodayKst 와 같은 시각 */
export function startOfTodayKstForCardPrice(now: Date = new Date()): Date {
  const seoul = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  seoul.setHours(0, 0, 0, 0)
  return seoul
}

export function isCardFutureMinDeparture(row: CardFutureDeparturePriceRow, nowFloor: Date): boolean {
  if (!(row.departureDate instanceof Date) || Number.isNaN(row.departureDate.getTime())) return false
  if (row.departureDate.getTime() < nowFloor.getTime()) return false
  return isDepartureRowPublicBookable({
    adult: row.adultPrice,
    seatCount: row.seatCount,
    seatsStatusRaw: row.seatsStatusRaw,
    statusRaw: row.statusRaw,
    isBookable: row.isBookable,
  })
}

/** 상한 없이 넘긴 행에서 카드 최저가. 80행만 넘기면 그 안의 최저만 나온다. */
export function minCardFutureAdultPrice(
  rows: readonly CardFutureDeparturePriceRow[],
  nowFloor: Date,
): number | null {
  let min: number | null = null
  for (const row of rows) {
    if (!isCardFutureMinDeparture(row, nowFloor)) continue
    const price = row.adultPrice
    if (price == null || price <= 0) continue
    if (min == null || price < min) min = price
  }
  return min
}

const CARD_MIN_ID_CHUNK = 400

/**
 * 상품별 미래 판매가능 성인가 최저. 행 take 없음.
 * REGRESSION-FREEZE[card-min-price-beyond-row-cap]: MIN(adultPrice) + isBookable null 유지 — manifest
 */
export async function fetchCardFutureMinAdultPriceByProductIds(
  productIds: readonly string[],
  nowFloor: Date,
): Promise<Map<string, number>> {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))]
  const out = new Map<string, number>()
  for (let i = 0; i < ids.length; i += CARD_MIN_ID_CHUNK) {
    const chunk = ids.slice(i, i + CARD_MIN_ID_CHUNK)
    const rows = await prisma.$queryRaw<Array<{ productId: string; minAdult: number | null }>>(Prisma.sql`
      SELECT pd."productId" AS "productId",
             MIN(pd."adultPrice") AS "minAdult"
      FROM "ProductDeparture" pd
      WHERE pd."productId" IN (${Prisma.join(chunk)})
        AND pd."departureDate" >= ${nowFloor}
        AND pd."adultPrice" > 0
        AND pd."isBookable" IS DISTINCT FROM false
        AND NOT (COALESCE(pd."statusRaw", '') ~* '예약[[:space:]]*마감|예약마감|마감|매진|sold[[:space:]]*out|불가|취소')
        AND NOT (
          COALESCE(pd."seatsStatusRaw", '') ~* '잔여[[:space:]]*0'
          OR COALESCE(pd."statusRaw", '') ~* '잔여[[:space:]]*0'
          OR (
            pd."seatCount" IS NOT NULL
            AND pd."seatCount" <= 0
            AND (COALESCE(pd."statusRaw", '') || ' ' || COALESCE(pd."seatsStatusRaw", '')) ~* '마감|만석|매진|판매[[:space:]]*완료|판매[[:space:]]*종료|sold[[:space:]]*out|예약[[:space:]]*불가|잔여[[:space:]]*0'
          )
        )
      GROUP BY pd."productId"
    `)
    for (const row of rows) {
      const n = Number(row.minAdult)
      if (Number.isFinite(n) && n > 0) out.set(row.productId, n)
    }
  }
  return out
}
