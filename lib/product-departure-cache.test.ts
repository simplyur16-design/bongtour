import { describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  isOverseasTrainingListingKind,
  planDepartureCache,
  recomputeProductDepartureCache,
  recomputeProductDepartureCacheSafe,
} from '@/lib/product-departure-cache'
import { isProductHiddenByPolicy } from '@/lib/product-sales-policy'

const utc = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)
const NOW = new Date('2026-11-14T12:00:00+09:00')
const TODAY = '2026-11-14'

type ProductRow = {
  id: string
  listingKind: string | null
  lastFutureDepartureDate: Date | null
  noFutureDepartureConfirmedAt: Date | null
}
type DepRow = { productId: string; departureDate: Date; adultPrice: number | null }

function fakePrisma(products: ProductRow[], deps: DepRow[]) {
  const updates: Array<{ id: string; data: Record<string, unknown> }> = []
  const prisma = {
    product: {
      findUnique: async ({ where }: { where: { id: string } }) => products.find((p) => p.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ id: where.id, data })
        const p = products.find((x) => x.id === where.id)!
        Object.assign(p, data)
        return p
      },
    },
    productDeparture: {
      findFirst: async ({ where }: { where: { productId: string; departureDate: { gte: Date }; adultPrice: { gt: number } } }) => {
        const rows = deps
          .filter(
            (d) =>
              d.productId === where.productId &&
              d.departureDate.getTime() >= where.departureDate.gte.getTime() &&
              d.adultPrice != null &&
              d.adultPrice > where.adultPrice.gt,
          )
          .sort((a, b) => b.departureDate.getTime() - a.departureDate.getTime())
        return rows[0] ? { departureDate: rows[0].departureDate } : null
      },
    },
  }
  return { prisma: prisma as unknown as PrismaClient, updates, products }
}

describe('product-departure-cache: planDepartureCache', () => {
  it('same date and no stale marker -> unchanged', () => {
    const p = planDepartureCache({ lastFutureDepartureDate: utc('2027-01-10'), noFutureDepartureConfirmedAt: null }, utc('2027-01-10'))
    expect(p.changed).toBe(false)
  })
  it('stale marker with real future departure -> clear marker', () => {
    const p = planDepartureCache(
      { lastFutureDepartureDate: utc('2027-01-10'), noFutureDepartureConfirmedAt: utc('2026-11-01') },
      utc('2027-01-10'),
    )
    expect(p).toMatchObject({ changed: true, clearMarker: true })
  })
  it('no actual future row -> cache becomes null, marker untouched', () => {
    const p = planDepartureCache({ lastFutureDepartureDate: utc('2027-03-17'), noFutureDepartureConfirmedAt: null }, null)
    expect(p).toMatchObject({ changed: true, nextLastFutureDepartureDate: null, clearMarker: false })
  })
})

// REGRESSION-FREEZE[departure-cache-from-rows]: 3개 예 상황 재현 — manifest
describe('product-departure-cache: 운영 사례 재현 (CPP7883 / JKB130 / EPP0211)', () => {
  it('CPP7883: 캐시 2027-03-17, 실제 출발은 이미 지남 -> 캐시 null, 공개 판정 숨김', async () => {
    const f = fakePrisma(
      [{ id: 'cpp7883', listingKind: 'travel', lastFutureDepartureDate: utc('2027-03-17'), noFutureDepartureConfirmedAt: null }],
      [
        { productId: 'cpp7883', departureDate: utc('2026-11-01'), adultPrice: 1_000_000 },
        { productId: 'cpp7883', departureDate: utc('2026-11-04'), adultPrice: 1_000_000 },
      ],
    )
    const r = await recomputeProductDepartureCache(f.prisma, 'cpp7883', { todayYmd: TODAY })
    expect(r.status).toBe('updated')
    expect(r.before.lastFutureDepartureDate).toBe('2027-03-17')
    expect(r.after.lastFutureDepartureDate).toBeNull()
    const row = f.products[0]!
    expect(row.lastFutureDepartureDate).toBeNull()
    expect(isProductHiddenByPolicy(row, NOW)).toBe(true)
  })

  it('JKB130: 캐시 2027-03-01, 실제 마지막 출발은 더 이름 -> 실제 값 또는 null 로 교정', async () => {
    const f = fakePrisma(
      [{ id: 'jkb130', listingKind: 'air_hotel_free', lastFutureDepartureDate: utc('2027-03-01'), noFutureDepartureConfirmedAt: null }],
      [
        { productId: 'jkb130', departureDate: utc('2026-11-02'), adultPrice: 500_000 },
        { productId: 'jkb130', departureDate: utc('2026-12-20'), adultPrice: 500_000 },
      ],
    )
    const r = await recomputeProductDepartureCache(f.prisma, 'jkb130', { todayYmd: TODAY })
    expect(r.after.lastFutureDepartureDate).toBe('2026-12-20')
    expect(f.products[0]!.lastFutureDepartureDate).toEqual(utc('2026-12-20'))
    expect(isProductHiddenByPolicy(f.products[0]!, NOW)).toBe(false)

    const gone = fakePrisma(
      [{ id: 'jkb130', listingKind: 'air_hotel_free', lastFutureDepartureDate: utc('2027-03-01'), noFutureDepartureConfirmedAt: null }],
      [{ productId: 'jkb130', departureDate: utc('2026-11-02'), adultPrice: 500_000 }],
    )
    await recomputeProductDepartureCache(gone.prisma, 'jkb130', { todayYmd: TODAY })
    expect(isProductHiddenByPolicy(gone.products[0]!, NOW)).toBe(true)
  })

  it('EPP0211: 캐시·마커 둘 다 비어 있고 미래 출발 없음 -> 공개 판정 숨김(fail-closed); 미래 출발이 있으면 캐시 채움', async () => {
    const none = fakePrisma(
      [{ id: 'epp0211', listingKind: 'travel', lastFutureDepartureDate: null, noFutureDepartureConfirmedAt: null }],
      [{ productId: 'epp0211', departureDate: utc('2026-10-11'), adultPrice: 900_000 }],
    )
    expect(isProductHiddenByPolicy(none.products[0]!, NOW)).toBe(true)
    const r = await recomputeProductDepartureCache(none.prisma, 'epp0211', { todayYmd: TODAY })
    expect(r.status).toBe('unchanged')
    expect(none.updates).toHaveLength(0)

    const some = fakePrisma(
      [{ id: 'epp0211', listingKind: 'travel', lastFutureDepartureDate: null, noFutureDepartureConfirmedAt: null }],
      [{ productId: 'epp0211', departureDate: utc('2027-02-23'), adultPrice: 900_000 }],
    )
    expect(isProductHiddenByPolicy(some.products[0]!, NOW)).toBe(true)
    await recomputeProductDepartureCache(some.prisma, 'epp0211', { todayYmd: TODAY })
    expect(some.products[0]!.lastFutureDepartureDate).toEqual(utc('2027-02-23'))
    expect(isProductHiddenByPolicy(some.products[0]!, NOW)).toBe(false)
  })
})

describe('product-departure-cache: otr 예외', () => {
  it('isOverseasTrainingListingKind', () => {
    expect(isOverseasTrainingListingKind('overseas_training')).toBe(true)
    expect(isOverseasTrainingListingKind(' overseas_training ')).toBe(true)
    expect(isOverseasTrainingListingKind('travel')).toBe(false)
    expect(isOverseasTrainingListingKind(null)).toBe(false)
  })

  it('otr 는 출발 row 가 없어도 재계산·쓰기 대상이 아니다(캐시 null 유지, 공개 유지)', async () => {
    const f = fakePrisma(
      [{ id: 'otr1', listingKind: 'overseas_training', lastFutureDepartureDate: null, noFutureDepartureConfirmedAt: null }],
      [],
    )
    const r = await recomputeProductDepartureCache(f.prisma, 'otr1', { todayYmd: TODAY })
    expect(r.status).toBe('skipped_otr')
    expect(f.updates).toHaveLength(0)
    expect(isProductHiddenByPolicy(f.products[0]!, NOW)).toBe(false)
  })
})

describe('product-departure-cache: 쓰기 동작', () => {
  it('성인가 0·null row 는 캐시에 반영하지 않는다', async () => {
    const f = fakePrisma(
      [{ id: 'p', listingKind: 'travel', lastFutureDepartureDate: null, noFutureDepartureConfirmedAt: null }],
      [
        { productId: 'p', departureDate: utc('2027-05-01'), adultPrice: 0 },
        { productId: 'p', departureDate: utc('2027-04-01'), adultPrice: null },
        { productId: 'p', departureDate: utc('2027-03-01'), adultPrice: 700_000 },
      ],
    )
    await recomputeProductDepartureCache(f.prisma, 'p', { todayYmd: TODAY })
    expect(f.products[0]!.lastFutureDepartureDate).toEqual(utc('2027-03-01'))
  })

  it('오늘(KST) 출발은 포함, 어제 출발은 제외', async () => {
    const f = fakePrisma(
      [{ id: 'p', listingKind: 'travel', lastFutureDepartureDate: null, noFutureDepartureConfirmedAt: null }],
      [
        { productId: 'p', departureDate: utc('2026-11-13'), adultPrice: 700_000 },
        { productId: 'p', departureDate: utc(TODAY), adultPrice: 700_000 },
      ],
    )
    await recomputeProductDepartureCache(f.prisma, 'p', { todayYmd: TODAY })
    expect(f.products[0]!.lastFutureDepartureDate).toEqual(utc(TODAY))
  })

  it('미래 출발이 있는데 마커가 남아 있으면 마커 해제', async () => {
    const f = fakePrisma(
      [{ id: 'p', listingKind: 'travel', lastFutureDepartureDate: utc('2027-03-01'), noFutureDepartureConfirmedAt: utc('2026-11-01') }],
      [{ productId: 'p', departureDate: utc('2027-03-01'), adultPrice: 700_000 }],
    )
    const r = await recomputeProductDepartureCache(f.prisma, 'p', { todayYmd: TODAY })
    expect(r.after.markerCleared).toBe(true)
    expect(f.products[0]!.noFutureDepartureConfirmedAt).toBeNull()
  })

  it('미래 출발이 없으면 기존 마커는 건드리지 않는다', async () => {
    const marker = utc('2026-11-01')
    const f = fakePrisma(
      [{ id: 'p', listingKind: 'travel', lastFutureDepartureDate: utc('2027-03-01'), noFutureDepartureConfirmedAt: marker }],
      [],
    )
    await recomputeProductDepartureCache(f.prisma, 'p', { todayYmd: TODAY })
    expect(f.products[0]!.noFutureDepartureConfirmedAt).toEqual(marker)
    expect(f.products[0]!.lastFutureDepartureDate).toBeNull()
  })

  it('dryRun 은 쓰지 않는다', async () => {
    const f = fakePrisma(
      [{ id: 'p', listingKind: 'travel', lastFutureDepartureDate: utc('2027-03-17'), noFutureDepartureConfirmedAt: null }],
      [],
    )
    const r = await recomputeProductDepartureCache(f.prisma, 'p', { todayYmd: TODAY, dryRun: true })
    expect(r.status).toBe('updated')
    expect(f.updates).toHaveLength(0)
  })

  it('Safe 변형은 예외를 삼키고 null 반환', async () => {
    const broken = {} as unknown as PrismaClient
    await expect(recomputeProductDepartureCacheSafe(broken, 'x', 't')).resolves.toBeNull()
  })
})
