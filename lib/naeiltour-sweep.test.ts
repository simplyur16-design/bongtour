import { beforeEach, describe, expect, it, vi } from 'vitest'

const upsertProductDepartures = vi.fn()
const productFindMany = vi.fn()
const productUpdate = vi.fn()

vi.mock('@/lib/upsert-product-departures-naeiltour', () => ({
  upsertProductDepartures: (...args: unknown[]) => upsertProductDepartures(...args),
}))

vi.mock('@/lib/revalidate-product-listing-caches', () => ({
  revalidateProductListingCaches: vi.fn(),
}))

vi.mock('@/lib/naeiltour-departures', () => ({
  collectNaeiltourProgramProcessDeparturesForUrl: vi.fn(),
  collectNaeiltourProgramProcessDeparturesForGoodCd: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prismaRead: {
    product: {
      findMany: (...args: unknown[]) => productFindMany(...args),
      findFirst: vi.fn(),
    },
  },
}))

import { sweepDueNaeiltourProducts } from '@/lib/naeiltour-sweep'

describe('naeiltour-sweep', () => {
  const prisma = {
    product: {
      findMany: productFindMany,
      findFirst: vi.fn(),
      update: productUpdate,
    },
  } as never

  beforeEach(() => {
    productFindMany.mockReset()
    productUpdate.mockReset()
    upsertProductDepartures.mockReset()
    productUpdate.mockResolvedValue({})
    upsertProductDepartures.mockResolvedValue(2)
  })

  it('collect mock → upsert called', async () => {
    productFindMany.mockResolvedValue([
      { id: 'p1', originUrl: 'https://www.naeiltour.co.kr/sub/view.asp?good_cd=ABC', originCode: 'ABC' },
    ])
    const r = await sweepDueNaeiltourProducts(prisma, {
      limit: 10,
      prismaRead: prisma,
      collectForProduct: async () => [
        {
          departDate: '2026-11-01',
          adultPrice: 999000,
          eventSeq: '1',
          carrierName: null,
          statusRaw: '예약가능',
          seatsStatusRaw: null,
          seatCount: null,
        },
      ],
    })
    expect(upsertProductDepartures).toHaveBeenCalledTimes(1)
    expect(r.updated).toBe(1)
    expect(r.skipped).toBe(0)
  })

  it('collect 0 rows → upsert not called, prices kept (skip)', async () => {
    productFindMany.mockResolvedValue([
      { id: 'p2', originUrl: 'https://www.naeiltour.co.kr/sub/view.asp?good_cd=XYZ', originCode: 'XYZ' },
    ])
    const r = await sweepDueNaeiltourProducts(prisma, {
      limit: 10,
      prismaRead: prisma,
      collectForProduct: async () => [],
    })
    expect(upsertProductDepartures).not.toHaveBeenCalled()
    expect(r.updated).toBe(0)
    expect(r.skipped).toBe(1)
    expect(productUpdate).toHaveBeenCalled()
  })

  it('due 없음 → no-op', async () => {
    productFindMany.mockResolvedValue([])
    const r = await sweepDueNaeiltourProducts(prisma, { limit: 10, prismaRead: prisma })
    expect(r.processed).toBe(0)
    expect(upsertProductDepartures).not.toHaveBeenCalled()
  })
})
