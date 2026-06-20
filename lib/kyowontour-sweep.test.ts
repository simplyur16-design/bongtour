/**
 * REGRESSION-FREEZE[kyowontour-sweep-e2e-recheck]
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'

import { collectKyowontourPriceInputsWithE2eFallback } from '@/lib/kyowontour-price-collect'
import {
  computeKyowontourNextPriceRecheckYmd,
  isKyowontourPriceRecheckDue,
  mergeKyowontourPriceRecheckIntoRawMeta,
} from '@/lib/kyowontour-price-recheck-meta'
import { reconcileRuleAMarkersWithDbFutureDepartures } from '@/lib/future-priced-departure-guard'
import { sweepDueKyowontourProducts } from '@/lib/kyowontour-sweep'

vi.mock('@/lib/kyowontour-price-collect', () => ({
  collectKyowontourPriceInputsWithE2eFallback: vi.fn(),
}))

vi.mock('@/lib/future-priced-departure-guard', () => ({
  reconcileRuleAMarkersWithDbFutureDepartures: vi.fn(),
}))

vi.mock('@/lib/upsert-product-departures-kyowontour', () => ({
  upsertProductDepartures: vi.fn(),
}))

vi.mock('@/lib/supplier-urgent-deal', () => ({
  syncSupplierUrgentDealForProduct: vi.fn(),
}))

vi.mock('@/lib/revalidate-product-listing-caches', () => ({
  revalidateProductListingCaches: vi.fn(),
}))

describe('isKyowontourPriceRecheckDue', () => {
  it('due when no recheck meta', () => {
    expect(isKyowontourPriceRecheckDue(null, '2026-06-20')).toBe(true)
  })

  it('not due before next recheck ymd', () => {
    const rawMeta = mergeKyowontourPriceRecheckIntoRawMeta(null, {
      nextRecheckYmd: '2026-06-25',
      collectSource: 'ajax',
      horizonVerifiedAtIso: '2026-06-18T00:00:00.000Z',
    })
    expect(isKyowontourPriceRecheckDue(rawMeta, '2026-06-20')).toBe(false)
  })

  it('due on or after next recheck ymd', () => {
    const rawMeta = mergeKyowontourPriceRecheckIntoRawMeta(null, {
      nextRecheckYmd: computeKyowontourNextPriceRecheckYmd('2026-06-18'),
      collectSource: 'e2e',
      horizonVerifiedAtIso: '2026-06-18T00:00:00.000Z',
    })
    expect(isKyowontourPriceRecheckDue(rawMeta, '2026-06-25')).toBe(true)
  })
})

describe('sweepDueKyowontourProducts horizonSoldOut', () => {
  const productId = 'prod-kyo-soldout'

  beforeEach(() => {
    vi.mocked(collectKyowontourPriceInputsWithE2eFallback).mockReset()
    vi.mocked(reconcileRuleAMarkersWithDbFutureDepartures).mockReset()
  })

  it('prunes horizon departures when collect marks horizonSoldOut', async () => {
    vi.mocked(collectKyowontourPriceInputsWithE2eFallback).mockResolvedValueOnce({
      inputs: [],
      horizonSoldOut: true,
      e2eAttempted: true,
      source: null,
      masterCode: 'CSP302',
      tourCodeHint: 'CSP302260621KE01',
      warnings: ['E2E 폴백 실패 또는 0건'],
    })
    vi.mocked(reconcileRuleAMarkersWithDbFutureDepartures).mockResolvedValueOnce({
      noFutureDepartureConfirmedAt: new Date('2026-06-19T00:00:00.000Z'),
      lastFutureDepartureDate: null,
    })

    const deleteMany = vi.fn().mockResolvedValue({ count: 3 })
    const update = vi.fn().mockResolvedValue({})
    const findFirst = vi.fn().mockResolvedValue({
      id: productId,
      originUrl: 'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=CSP302260621KE01&menuCode=M5204&brandId=3',
      originCode: 'CSP302',
      rawMeta: null,
    })

    const prisma = {
      product: { findFirst, findMany: vi.fn(), update },
      productDeparture: { deleteMany },
    } as unknown as PrismaClient

    const result = await sweepDueKyowontourProducts(prisma, { productId })
    expect(result.horizonSoldOut).toBe(1)
    expect(result.pruned).toBe(3)
    expect(deleteMany).toHaveBeenCalled()
    expect(update).toHaveBeenCalled()
  })
})
