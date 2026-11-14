import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { recomputeProductDepartureCache } from '@/lib/product-departure-cache'

const utc = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)
const TODAY = '2026-11-14'

type Row = { id: string; listingKind: string | null; lastFutureDepartureDate: Date | null; noFutureDepartureConfirmedAt: Date | null }

/** findFirst(MAX 출발) 와 UPDATE 사이에 다른 저장 경로가 캐시를 먼저 쓰는 경쟁을 흉내낸다. */
function racyPrisma(row: Row, staleMax: Date | null, concurrentWrite: Date | null) {
  const writes: Array<Record<string, unknown>> = []
  const prisma = {
    product: {
      findUnique: async () => ({ ...row }),
      update: async () => {
        throw new Error('unguarded update must not be used')
      },
      updateMany: async ({ where, data }: { where: Row; data: Record<string, unknown> }) => {
        const same = (a: Date | null, b: Date | null) => (a == null || b == null ? a == null && b == null : a.getTime() === b.getTime())
        if (!same(row.lastFutureDepartureDate, where.lastFutureDepartureDate) || !same(row.noFutureDepartureConfirmedAt, where.noFutureDepartureConfirmedAt)) {
          return { count: 0 }
        }
        writes.push(data)
        Object.assign(row, data)
        return { count: 1 }
      },
    },
    productDeparture: {
      findFirst: async () => {
        // 이 상품의 출발 row 를 읽은 직후, 동시 저장이 새 출발 row 를 넣고 캐시를 먼저 갱신
        if (concurrentWrite) row.lastFutureDepartureDate = concurrentWrite
        return staleMax ? { departureDate: staleMax } : null
      },
    },
  }
  return { prisma: prisma as unknown as PrismaClient, writes, row }
}

describe('PR112 fix: guarded cache UPDATE', () => {
  it('concurrent save wrote a newer cache -> worker does not overwrite it (conflict)', async () => {
    const f = racyPrisma({ id: 'p1', listingKind: 'travel', lastFutureDepartureDate: null, noFutureDepartureConfirmedAt: null }, utc('2027-02-24'), utc('2027-03-02'))
    const r = await recomputeProductDepartureCache(f.prisma, 'p1', { todayYmd: TODAY })
    expect(r.status).toBe('conflict')
    expect(f.writes).toHaveLength(0)
    expect(f.row.lastFutureDepartureDate).toEqual(utc('2027-03-02'))
  })
  it('no concurrent write -> guarded UPDATE applies (count 1)', async () => {
    const f = racyPrisma({ id: 'p2', listingKind: 'travel', lastFutureDepartureDate: null, noFutureDepartureConfirmedAt: null }, utc('2027-02-24'), null)
    const r = await recomputeProductDepartureCache(f.prisma, 'p2', { todayYmd: TODAY })
    expect(r.status).toBe('updated')
    expect(f.writes).toEqual([{ lastFutureDepartureDate: utc('2027-02-24') }])
  })
})

describe('PR112 fix: boot catch-up reconcile', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.doUnmock('node-cron')
    vi.doUnmock('@/lib/departure-cache-reconcile')
    vi.doUnmock('@/lib/prisma')
  })
  it('schedules 00:40 Asia/Seoul and runs one reconcile shortly after start', async () => {
    vi.useFakeTimers()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DATABASE_URL', 'postgres://test')
    const schedule = vi.fn()
    const run = vi.fn(async () => ({
      todayYmd: TODAY, dryRun: false, mismatched: 0, fixed: 0, capped: false, errors: 0,
      byKind: { cache_later_than_actual: 0, cache_earlier_than_actual: 0, cache_empty: 0, stale_marker: 0 }, rollback: [],
    }))
    vi.doMock('node-cron', () => ({ default: { schedule } }))
    vi.doMock('@/lib/prisma', () => ({ prisma: {} }))
    vi.doMock('@/lib/departure-cache-reconcile', () => ({ runDepartureCacheReconcile: run, buildDepartureCacheRollbackSql: () => '' }))
    const m = await import('@/lib/instrumentation-departure-cache-reconcile-cron')
    m.startInstrumentationDepartureCacheReconcileCron()
    await vi.waitFor(() => expect(schedule).toHaveBeenCalledTimes(1))
    expect(schedule.mock.calls[0]![0]).toBe('40 0 * * *')
    expect(schedule.mock.calls[0]![2]).toEqual({ timezone: 'Asia/Seoul' })
    expect(run).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(m.DEPARTURE_CACHE_RECONCILE_BOOT_DELAY_MS)
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1))
  })
  it('disable env -> no schedule and no boot run', async () => {
    vi.useFakeTimers()
    vi.stubEnv('DISABLE_INSTRUMENTATION_DEPARTURE_CACHE_RECONCILE_CRON', '1')
    const schedule = vi.fn()
    vi.doMock('node-cron', () => ({ default: { schedule } }))
    const m = await import('@/lib/instrumentation-departure-cache-reconcile-cron')
    m.startInstrumentationDepartureCacheReconcileCron()
    await vi.advanceTimersByTimeAsync(m.DEPARTURE_CACHE_RECONCILE_BOOT_DELAY_MS + 1000)
    expect(schedule).not.toHaveBeenCalled()
  })
})
