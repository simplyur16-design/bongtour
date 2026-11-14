import { describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  DEPARTURE_CACHE_MISMATCH_SQL,
  buildDepartureCacheRollbackSql,
  classifyDepartureCacheMismatch,
  runDepartureCacheReconcile,
  type DepartureCacheMismatchRow,
} from '@/lib/departure-cache-reconcile'

const utc = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)
const TODAY = '2026-11-14'

type ProductRow = {
  id: string
  listingKind: string | null
  lastFutureDepartureDate: Date | null
  noFutureDepartureConfirmedAt: Date | null
}

function fake(products: ProductRow[], deps: Array<{ productId: string; departureDate: Date; adultPrice: number }>, mismatches: DepartureCacheMismatchRow[]) {
  const updates: string[] = []
  const prisma = {
    $queryRawUnsafe: async () => mismatches,
    product: {
      findUnique: async ({ where }: { where: { id: string } }) => products.find((p) => p.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push(where.id)
        Object.assign(products.find((p) => p.id === where.id)!, data)
      },
      updateMany: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push(where.id)
        Object.assign(products.find((p) => p.id === where.id)!, data)
        return { count: 1 }
      },
    },
    productDeparture: {
      findFirst: async ({ where }: { where: { productId: string; departureDate: { gte: Date } } }) => {
        const rows = deps
          .filter((d) => d.productId === where.productId && d.departureDate.getTime() >= where.departureDate.gte.getTime() && d.adultPrice > 0)
          .sort((a, b) => b.departureDate.getTime() - a.departureDate.getTime())
        return rows[0] ? { departureDate: rows[0].departureDate } : null
      },
    },
  }
  return { prisma: prisma as unknown as PrismaClient, updates }
}

// REGRESSION-FREEZE[departure-cache-nightly-reconcile]: 야간 불일치 탐지·재계산·되돌리기 기록 — manifest
describe('departure-cache-reconcile', () => {
  const products: ProductRow[] = [
    { id: 'cpp7883', listingKind: 'travel', lastFutureDepartureDate: utc('2027-03-17'), noFutureDepartureConfirmedAt: null },
    { id: 'jkb130', listingKind: 'air_hotel_free', lastFutureDepartureDate: utc('2027-03-01'), noFutureDepartureConfirmedAt: null },
    { id: 'epp0211', listingKind: 'travel', lastFutureDepartureDate: null, noFutureDepartureConfirmedAt: null },
  ]
  const deps = [
    { productId: 'cpp7883', departureDate: utc('2026-11-04'), adultPrice: 100 },
    { productId: 'jkb130', departureDate: utc('2026-12-20'), adultPrice: 100 },
    { productId: 'epp0211', departureDate: utc('2027-02-23'), adultPrice: 100 },
  ]
  const mismatches: DepartureCacheMismatchRow[] = [
    { id: 'cpp7883', originCode: 'CPP7883-261014QW5', cacheYmd: '2027-03-17', actualYmd: null, markerSet: false },
    { id: 'jkb130', originCode: 'JKB130260611TWN', cacheYmd: '2027-03-01', actualYmd: '2026-12-20', markerSet: false },
    { id: 'epp0211', originCode: 'EPP0211-260919LO8', cacheYmd: null, actualYmd: '2027-02-23', markerSet: false },
  ]

  it('3개 예 상황: 불일치 유형 분류', () => {
    expect(classifyDepartureCacheMismatch(mismatches[0]!)).toBe('cache_later_than_actual')
    expect(classifyDepartureCacheMismatch(mismatches[1]!)).toBe('cache_later_than_actual')
    expect(classifyDepartureCacheMismatch(mismatches[2]!)).toBe('cache_empty')
    expect(classifyDepartureCacheMismatch({ cacheYmd: '2027-01-01', actualYmd: '2027-02-01', markerSet: false })).toBe('cache_earlier_than_actual')
    expect(classifyDepartureCacheMismatch({ cacheYmd: '2027-01-01', actualYmd: '2027-01-01', markerSet: true })).toBe('stale_marker')
  })

  it('불일치 3건을 고치고 건수·되돌리기 기록을 남긴다', async () => {
    const p = products.map((x) => ({ ...x }))
    const f = fake(p, deps, mismatches)
    const s = await runDepartureCacheReconcile(f.prisma, { todayYmd: TODAY })
    expect(s).toMatchObject({ mismatched: 3, fixed: 3, errors: 0, capped: false, dryRun: false })
    expect(s.byKind).toMatchObject({ cache_later_than_actual: 2, cache_empty: 1 })
    expect(p.find((x) => x.id === 'cpp7883')!.lastFutureDepartureDate).toBeNull()
    expect(p.find((x) => x.id === 'jkb130')!.lastFutureDepartureDate).toEqual(utc('2026-12-20'))
    expect(p.find((x) => x.id === 'epp0211')!.lastFutureDepartureDate).toEqual(utc('2027-02-23'))
    expect(s.rollback.find((r) => r.productId === 'cpp7883')).toMatchObject({
      originCode: 'CPP7883-261014QW5',
      lastFutureDepartureDate: '2027-03-17',
      noFutureDepartureConfirmedAt: null,
    })
  })

  it('dryRun 은 고친 건수만 세고 쓰지 않는다', async () => {
    const p = products.map((x) => ({ ...x }))
    const f = fake(p, deps, mismatches)
    const s = await runDepartureCacheReconcile(f.prisma, { todayYmd: TODAY, dryRun: true })
    expect(s.fixed).toBe(3)
    expect(f.updates).toHaveLength(0)
  })

  it('maxFixes 상한', async () => {
    const p = products.map((x) => ({ ...x }))
    const f = fake(p, deps, mismatches)
    const s = await runDepartureCacheReconcile(f.prisma, { todayYmd: TODAY, maxFixes: 1 })
    expect(s).toMatchObject({ mismatched: 3, fixed: 1, capped: true })
  })

  it('otr 는 SQL 대상에서 제외되고 재계산에서도 건너뛴다', async () => {
    expect(DEPARTURE_CACHE_MISMATCH_SQL).toContain(`COALESCE(p."listingKind", '') <> 'overseas_training'`)
    const p: ProductRow[] = [{ id: 'otr', listingKind: 'overseas_training', lastFutureDepartureDate: null, noFutureDepartureConfirmedAt: null }]
    const f = fake(p, [], [{ id: 'otr', originCode: null, cacheYmd: null, actualYmd: '2027-01-01', markerSet: false }])
    const s = await runDepartureCacheReconcile(f.prisma, { todayYmd: TODAY })
    expect(s.fixed).toBe(0)
    expect(f.updates).toHaveLength(0)
  })

  it('되돌리기 SQL', () => {
    expect(
      buildDepartureCacheRollbackSql({
        productId: 'abc',
        originCode: null,
        lastFutureDepartureDate: '2027-03-17',
        noFutureDepartureConfirmedAt: null,
      }),
    ).toBe(
      `UPDATE "Product" SET "lastFutureDepartureDate" = '2027-03-17 00:00:00', "noFutureDepartureConfirmedAt" = NULL WHERE id = 'abc';`,
    )
  })
})
