/**
 * 야간 자가 점검 — 마지막 출발일 캐시(Product.lastFutureDepartureDate) vs 실제 ProductDeparture 불일치 탐지·재계산.
 * 출발 row 쓰기 경로가 놓친 값(과거 데이터·직접 수정·수집 실패)을 하루 한 번 맞춘다.
 *
 * - 대상: registered, 국외연수(otr) 제외. 캐시가 실제(오늘 KST 이후 성인가>0 MAX)와 다르거나,
 *   미래 출발이 있는데 마커가 남은 상품.
 * - 고친 건수와 되돌리기(rollback) 기록은 결과·로그(JSON 한 줄)로 남긴다. 스키마 변경 없음.
 *
 * REGRESSION-FREEZE[departure-cache-nightly-reconcile]: 캐시 불일치 탐지·재계산·되돌리기 기록 — manifest
 */
import type { PrismaClient } from '@prisma/client'
import { kstTodayYmd } from '@/lib/calendar-ymd'
import {
  recomputeProductDepartureCache,
  type DepartureCacheRecomputeResult,
} from '@/lib/product-departure-cache'

/** 한 번의 야간 실행에서 고칠 최대 건수(폭주 방지). */
export const DEPARTURE_CACHE_RECONCILE_MAX_FIXES = 500

export type DepartureCacheMismatchRow = {
  id: string
  originCode: string | null
  cacheYmd: string | null
  actualYmd: string | null
  markerSet: boolean
}

export type DepartureCacheRollbackEntry = {
  productId: string
  originCode: string | null
  lastFutureDepartureDate: string | null
  noFutureDepartureConfirmedAt: string | null
}

export type DepartureCacheReconcileSummary = {
  todayYmd: string
  dryRun: boolean
  mismatched: number
  fixed: number
  capped: boolean
  errors: number
  byKind: { cache_later_than_actual: number; cache_earlier_than_actual: number; cache_empty: number; stale_marker: number }
  rollback: DepartureCacheRollbackEntry[]
}

export const DEPARTURE_CACHE_MISMATCH_SQL = `
SELECT p.id,
       p."originCode" AS "originCode",
       to_char(p."lastFutureDepartureDate", 'YYYY-MM-DD') AS "cacheYmd",
       to_char(a.true_last, 'YYYY-MM-DD') AS "actualYmd",
       (p."noFutureDepartureConfirmedAt" IS NOT NULL) AS "markerSet"
FROM "Product" p
LEFT JOIN (
  SELECT "productId", MAX("departureDate") AS true_last
  FROM "ProductDeparture"
  WHERE "adultPrice" > 0 AND "departureDate" >= $1::timestamp
  GROUP BY "productId"
) a ON a."productId" = p.id
WHERE p."registrationStatus" = 'registered'
  AND COALESCE(p."listingKind", '') <> 'overseas_training'
  AND (
    p."lastFutureDepartureDate" IS DISTINCT FROM a.true_last
    OR (a.true_last IS NOT NULL AND p."noFutureDepartureConfirmedAt" IS NOT NULL)
  )
ORDER BY p.id
`

export function classifyDepartureCacheMismatch(
  r: Pick<DepartureCacheMismatchRow, 'cacheYmd' | 'actualYmd' | 'markerSet'>,
): keyof DepartureCacheReconcileSummary['byKind'] {
  if (r.cacheYmd == null && r.actualYmd != null) return 'cache_empty'
  if (r.cacheYmd != null && (r.actualYmd == null || r.cacheYmd > r.actualYmd)) return 'cache_later_than_actual'
  if (r.cacheYmd != null && r.actualYmd != null && r.cacheYmd < r.actualYmd) return 'cache_earlier_than_actual'
  return 'stale_marker'
}

/** 되돌리기용 UPDATE 문 — 운영자가 로그의 rollback 항목으로 복원할 때 쓴다. */
export function buildDepartureCacheRollbackSql(e: DepartureCacheRollbackEntry): string {
  const q = (v: string | null) => (v == null ? 'NULL' : `'${v.replace(/'/g, "''")}'`)
  return (
    `UPDATE "Product" SET "lastFutureDepartureDate" = ${q(e.lastFutureDepartureDate ? `${e.lastFutureDepartureDate} 00:00:00` : null)}, ` +
    `"noFutureDepartureConfirmedAt" = ${q(e.noFutureDepartureConfirmedAt)} WHERE id = ${q(e.productId)};`
  )
}

export async function findDepartureCacheMismatches(
  prisma: PrismaClient,
  todayYmd: string,
): Promise<DepartureCacheMismatchRow[]> {
  return prisma.$queryRawUnsafe<DepartureCacheMismatchRow[]>(DEPARTURE_CACHE_MISMATCH_SQL, `${todayYmd} 00:00:00`)
}

export async function runDepartureCacheReconcile(
  prisma: PrismaClient,
  opts: { dryRun?: boolean; todayYmd?: string; maxFixes?: number } = {},
): Promise<DepartureCacheReconcileSummary> {
  const todayYmd = opts.todayYmd ?? kstTodayYmd()
  const dryRun = opts.dryRun === true
  const maxFixes = opts.maxFixes ?? DEPARTURE_CACHE_RECONCILE_MAX_FIXES
  const rows = await findDepartureCacheMismatches(prisma, todayYmd)
  const summary: DepartureCacheReconcileSummary = {
    todayYmd,
    dryRun,
    mismatched: rows.length,
    fixed: 0,
    capped: rows.length > maxFixes,
    errors: 0,
    byKind: { cache_later_than_actual: 0, cache_earlier_than_actual: 0, cache_empty: 0, stale_marker: 0 },
    rollback: [],
  }
  for (const r of rows) summary.byKind[classifyDepartureCacheMismatch(r)] += 1

  for (const r of rows.slice(0, maxFixes)) {
    let res: DepartureCacheRecomputeResult
    try {
      res = await recomputeProductDepartureCache(prisma, r.id, { todayYmd, dryRun })
    } catch (e) {
      summary.errors += 1
      console.warn('[departure-cache-reconcile] recompute failed', {
        productId: r.id,
        message: (e instanceof Error ? e.message : String(e)).slice(0, 300),
      })
      continue
    }
    if (res.status !== 'updated') continue
    summary.fixed += 1
    summary.rollback.push({
      productId: r.id,
      originCode: r.originCode,
      lastFutureDepartureDate: res.before.lastFutureDepartureDate,
      noFutureDepartureConfirmedAt: res.before.noFutureDepartureConfirmedAt,
    })
  }
  return summary
}
