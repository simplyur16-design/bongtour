import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as vgPrice from '@/lib/verygoodtour-price-collect'
import { isVerygoodtourDetailUrlExpired } from '@/lib/verygoodtour-detail-url-health'
import { collectVerygoodE2eDepartureInputsForDateRange } from '@/lib/admin-departure-rescrape'

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
  beforeEach(() => {
    vi.mocked(isVerygoodtourDetailUrlExpired).mockReset()
    vi.mocked(collectVerygoodE2eDepartureInputsForDateRange).mockReset()
    vi.mocked(isVerygoodtourDetailUrlExpired).mockResolvedValue(false)
    vi.spyOn(vgPrice, 'collectVerygoodHxrOnlyForDateRange').mockRestore()
  })

  it('returns E2E rows when HXR has no priced right rows', async () => {
    vi.spyOn(vgPrice, 'collectVerygoodHxrOnlyForDateRange').mockResolvedValueOnce({
      inputs: [],
      masterCode: 'EPP0113',
      menuCode: '101',
      rightRowCount: 0,
      leftWithPriceCount: 6,
      hxrError: null,
      warnings: ['2026-06:right_rows_empty'],
    })
    vi.mocked(collectVerygoodE2eDepartureInputsForDateRange).mockResolvedValueOnce([
      { departureDate: '2026-07-01', adultPrice: 1290000 },
    ])

    const out = await vgPrice.collectVerygoodtourPriceInputsWithE2eFallback(
      'https://www.verygoodtour.com/Product/PackageDetail?ProCode=EPP0113-260424SK&PriceSeq=1&MenuCode=leaveLayer',
      '2026-06-20',
      '2026-12-17',
    )

    expect(out.source).toBe('e2e')
    expect(out.e2eAttempted).toBe(true)
    expect(out.horizonSoldOut).toBe(false)
    expect(out.inputs).toHaveLength(1)
    expect(out.detailUrl).not.toContain('MenuCode')
  })

  it('sets horizonSoldOut when URL expired', async () => {
    vi.mocked(isVerygoodtourDetailUrlExpired).mockResolvedValueOnce(true)

    const out = await vgPrice.collectVerygoodtourPriceInputsWithE2eFallback(
      'https://www.verygoodtour.com/Product/PackageDetail?ProCode=STALE-000&PriceSeq=1',
      '2026-06-20',
      '2026-12-17',
    )

    expect(out.horizonSoldOut).toBe(true)
    expect(out.e2eAttempted).toBe(false)
    expect(collectVerygoodE2eDepartureInputsForDateRange).not.toHaveBeenCalled()
  })
})
