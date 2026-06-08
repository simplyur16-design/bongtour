import type { PrismaClient } from '@prisma/client'

/**
 * `lib/public-bookable-date.ts` — 오늘(자정) + 2일 이후 출발만 예약 가능.
 * Node `lib/public-bookable-date.ts` 도 **Asia/Seoul** 자정+2일 (DB·트리거와 동일).
 * facet/정렬 SSOT는 DB 쪽; 단계 2에서 browse가 이 컬럼을 읽는다.
 */

/** Seoul (today + 2 days) 이후 출발만 집계 — migration·cron 과 동일 */
export const BOOKABLE_MIN_DATE_SEoul_SQL = `((NOW() AT TIME ZONE 'Asia/Seoul')::date + INTERVAL '2 days')::date`

/** 전체 Product 백필 — migration step 4·nightly cron 공용 */
export const SYNC_ALL_PRODUCTS_BOOKABLE_DERIVED_SQL = `
WITH bookable_min AS (
  SELECT ${BOOKABLE_MIN_DATE_SEoul_SQL} AS d
),
agg AS (
  SELECT
    pd."productId",
    MIN(pd."adultPrice") FILTER (
      WHERE pd."adultPrice" IS NOT NULL
        AND pd."adultPrice" > 0
        AND (pd."isBookable" IS DISTINCT FROM false)
        AND (pd."seatCount" IS NULL OR pd."seatCount" > 0)
        AND NOT (
          COALESCE(pd."statusRaw", '') ~* '마감|만석|매진|판매\\s*완료|판매\\s*종료'
          OR COALESCE(pd."seatsStatusRaw", '') ~* '마감|만석|매진|잔여\\s*0'
        )
    ) AS min_adult,
    MIN(pd."departureDate") FILTER (
      WHERE pd."adultPrice" IS NOT NULL
        AND pd."adultPrice" > 0
        AND (pd."isBookable" IS DISTINCT FROM false)
        AND (pd."seatCount" IS NULL OR pd."seatCount" > 0)
        AND NOT (
          COALESCE(pd."statusRaw", '') ~* '마감|만석|매진|판매\\s*완료|판매\\s*종료'
          OR COALESCE(pd."seatsStatusRaw", '') ~* '마감|만석|매진|잔여\\s*0'
        )
    ) AS min_dep,
    COUNT(*) FILTER (
      WHERE pd."adultPrice" IS NOT NULL
        AND pd."adultPrice" > 0
        AND (pd."isBookable" IS DISTINCT FROM false)
        AND (pd."seatCount" IS NULL OR pd."seatCount" > 0)
        AND NOT (
          COALESCE(pd."statusRaw", '') ~* '마감|만석|매진|판매\\s*완료|판매\\s*종료'
          OR COALESCE(pd."seatsStatusRaw", '') ~* '마감|만석|매진|잔여\\s*0'
        )
    )::int AS cnt
  FROM "ProductDeparture" pd
  CROSS JOIN bookable_min bm
  WHERE (pd."departureDate" AT TIME ZONE 'Asia/Seoul')::date >= bm.d
  GROUP BY pd."productId"
)
UPDATE "Product" p
SET
  "minBookableAdultPrice" = a.min_adult,
  "nextBookableDepartureAt" = a.min_dep,
  "bookableDepartureCount" = a.cnt,
  "hasBookableDepartures" = (a.cnt > 0)
FROM agg a
WHERE p.id = a."productId";

WITH bookable_min AS (
  SELECT ${BOOKABLE_MIN_DATE_SEoul_SQL} AS d
)
UPDATE "Product" p
SET
  "minBookableAdultPrice" = NULL,
  "nextBookableDepartureAt" = NULL,
  "bookableDepartureCount" = 0,
  "hasBookableDepartures" = false
WHERE NOT EXISTS (
  SELECT 1
  FROM "ProductDeparture" pd
  CROSS JOIN bookable_min bm
  WHERE pd."productId" = p.id
    AND (pd."departureDate" AT TIME ZONE 'Asia/Seoul')::date >= bm.d
);
`

export async function syncAllProductsBookableDerived(
  prisma: PrismaClient,
  opts: { dryRun?: boolean } = {}
): Promise<{ dryRun: boolean; productCount: number }> {
  const productCount = await prisma.product.count()
  if (opts.dryRun) {
    return { dryRun: true, productCount }
  }
  await prisma.$executeRawUnsafe(SYNC_ALL_PRODUCTS_BOOKABLE_DERIVED_SQL)
  return { dryRun: false, productCount }
}
