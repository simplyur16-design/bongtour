import { describe, expect, it, vi } from 'vitest'

import { isVerygoodtourDetailUrlExpired } from '@/lib/verygoodtour-detail-url-health'
import { collectVerygoodE2eDepartureInputsForDateRange } from '@/lib/admin-departure-rescrape'
import { collectVerygoodtourPriceInputsWithE2eFallback } from '@/lib/verygoodtour-price-collect'

vi.mock('@/lib/verygoodtour-detail-url-health', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/verygoodtour-detail-url-health')>()
  return {
    ...actual,
    isVerygoodtourDetailUrlExpired: vi.fn(),
  }
})

vi.mock('@/lib/admin-departure-rescrape', () => ({
  collectVerygoodE2eDepartureInputsForDateRange: vi.fn(),
}))

describe('collectVerygoodtourPriceInputsWithE2eFallback', () => {
  it('sets horizonSoldOut when URL expired', async () => {
    vi.mocked(isVerygoodtourDetailUrlExpired).mockResolvedValueOnce(true)

    const out = await collectVerygoodtourPriceInputsWithE2eFallback(
      'https://www.verygoodtour.com/Product/PackageDetail?ProCode=STALE-000&PriceSeq=1',
      '2026-06-20',
      '2026-12-17',
    )

    expect(out.horizonSoldOut).toBe(true)
    expect(out.e2eAttempted).toBe(false)
    expect(collectVerygoodE2eDepartureInputsForDateRange).not.toHaveBeenCalled()
  })
})
