import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'

import {
  computeVerygoodtourNextPriceRecheckYmd,
  isVerygoodtourPriceRecheckDue,
  mergeVerygoodtourPriceRecheckIntoRawMeta,
} from '@/lib/verygoodtour-price-recheck-meta'
import { collectVerygoodtourPriceInputsWithE2eFallback } from '@/lib/verygoodtour-price-collect'
import { reconcileRuleAMarkersWithDbFutureDepartures } from '@/lib/future-priced-departure-guard'
import { sweepDueVerygoodtourProducts } from '@/lib/verygoodtour-sweep'

vi.mock('@/lib/verygoodtour-price-collect', () => ({
  collectVerygoodtourPriceInputsWithE2eFallback: vi.fn(),
}))

vi.mock('@/lib/future-priced-departure-guard', () => ({
  reconcileRuleAMarkersWithDbFutureDepartures: vi.fn(),
}))

vi.mock('@/lib/upsert-product-departures-verygoodtour', () => ({
  upsertProductDepartures: vi.fn(),
}))

vi.mock('@/lib/supplier-urgent-deal', () => ({
  syncSupplierUrgentDealForProduct: vi.fn(),
}))

vi.mock('@/lib/revalidate-product-listing-caches', () => ({
  revalidateProductListingCaches: vi.fn(),
}))

describe('isVerygoodtourPriceRecheckDue', () => {
  it('due when no recheck meta', () => {
    expect(isVerygoodtourPriceRecheckDue(null, '2026-06-20')).toBe(true)
  })

  it('not due before next recheck ymd', () => {
    const rawMeta = mergeVerygoodtourPriceRecheckIntoRawMeta(null, {
      nextRecheckYmd: '2026-06-25',
      collectSource: 'hxr',
      horizonVerifiedAtIso: '2026-06-18T00:00:00.000Z',
    })
    expect(isVerygoodtourPriceRecheckDue(rawMeta, '2026-06-20')).toBe(false)
  })

  it('due on or after next recheck ymd', () => {
    const rawMeta = mergeVerygoodtourPriceRecheckIntoRawMeta(null, {
      nextRecheckYmd: computeVerygoodtourNextPriceRecheckYmd('2026-06-18'),
      collectSource: 'e2e',
      horizonVerifiedAtIso: '2026-06-18T00:00:00.000Z',
    })
    expect(isVerygoodtourPriceRecheckDue(rawMeta, '2026-06-25')).toBe(true)
  })
})

describe('sweepDueVerygoodtourProducts horizonSoldOut', () => {
  const productId = 'prod-expired-1'

  beforeEach(() => {
    vi.mocked(collectVerygoodtourPriceInputsWithE2eFallback).mockReset()
    vi.mocked(reconcileRuleAMarkersWithDbFutureDepartures).mockReset()
  })

  it('prunes horizon departures and clears priceFrom when collect marks horizonSoldOut', async () => {
    vi.mocked(collectVerygoodtourPriceInputsWithE2eFallback).mockResolvedValueOnce({
      inputs: [],
      horizonSoldOut: true,
      e2eAttempted: false,
      source: null,
      detailUrl: 'https://www.verygoodtour.com/Product/PackageDetail?ProCode=STALE&PriceSeq=1',
      warnings: ['detail_url_expired'],
    })
    vi.mocked(reconcileRuleAMarkersWithDbFutureDepartures).mockResolvedValueOnce({
      marked: true,
      noFutureDepartureConfirmedAt: new Date('2026-06-19T00:00:00.000Z'),
      lastFutureDepartureDate: null,
    })

    const deleteMany = vi.fn().mockResolvedValue({ count: 5 })
    const update = vi.fn().mockResolvedValue({})
    const prisma = {
      product: {
        findFirst: vi.fn().mockResolvedValue({
          id: productId,
          originUrl:
            'https://www.verygoodtour.com/Product/PackageDetail?ProCode=STALE-000&PriceSeq=1',
          originCode: 'STALE-000',
          rawMeta: null,
        }),
        update,
      },
      productDeparture: { deleteMany },
    } as unknown as PrismaClient

    const result = await sweepDueVerygoodtourProducts(prisma, { productId, limit: 1 })

    expect(result.horizonSoldOut).toBe(1)
    expect(result.pruned).toBe(5)
    expect(result.updated).toBe(0)
    expect(deleteMany).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: productId },
        data: expect.objectContaining({
          priceFrom: null,
          noFutureDepartureConfirmedAt: expect.any(Date),
        }),
      }),
    )
  })
})
