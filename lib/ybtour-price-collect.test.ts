import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectYbtourPriceInputsWithE2eFallback } from '@/lib/ybtour-price-collect'

const collectYbtourApiDepartureInputsForUrl = vi.fn()
const collectYbtourE2eDepartureInputsForDateRange = vi.fn()

vi.mock('@/lib/ybtour-api-departures', () => ({
  collectYbtourApiDepartureInputsForUrl: (...args: unknown[]) =>
    collectYbtourApiDepartureInputsForUrl(...args),
  filterYbtourInputsInYmdWindow: (inputs: { departureDate: string; adultPrice?: number }[], lo: string, hi: string) =>
    inputs.filter((x) => x.departureDate >= lo && x.departureDate <= hi && (x.adultPrice ?? 0) > 0),
}))

vi.mock('@/lib/admin-departure-rescrape', () => ({
  collectYbtourE2eDepartureInputsForDateRange: (...args: unknown[]) =>
    collectYbtourE2eDepartureInputsForDateRange(...args),
}))

describe('collectYbtourPriceInputsWithE2eFallback', () => {
  beforeEach(() => {
    collectYbtourApiDepartureInputsForUrl.mockReset()
    collectYbtourE2eDepartureInputsForDateRange.mockReset()
  })

  it('returns api rows without E2E when API has priced departures', async () => {
    collectYbtourApiDepartureInputsForUrl.mockResolvedValueOnce({
      inputs: [{ departureDate: '2026-07-03', adultPrice: 2690000 }],
      evCd: 'EEP1284-260703LO01',
      title: '테스트',
    })

    const out = await collectYbtourPriceInputsWithE2eFallback(
      'https://prdt.ybtour.co.kr/product/detailPackage?evCd=EEP1284-260703LO01',
      'EEP1284',
      '2026-07-01',
      '2026-07-31',
    )

    expect(out.source).toBe('api')
    expect(out.e2eAttempted).toBe(false)
    expect(out.inputs).toHaveLength(1)
    expect(collectYbtourE2eDepartureInputsForDateRange).not.toHaveBeenCalled()
  })

  it('falls back to E2E when API returns no priced rows in window', async () => {
    collectYbtourApiDepartureInputsForUrl.mockResolvedValueOnce({ inputs: [], evCd: null, title: null })
    collectYbtourE2eDepartureInputsForDateRange.mockResolvedValueOnce([
      { departureDate: '2026-08-01', adultPrice: 1200000 },
    ])

    const out = await collectYbtourPriceInputsWithE2eFallback(
      'https://prdt.ybtour.co.kr/product/detailPackage?evCd=EEP1284-260703LO01',
      'EEP1284',
      '2026-08-01',
      '2026-08-31',
    )

    expect(out.source).toBe('e2e')
    expect(out.e2eAttempted).toBe(true)
    expect(out.inputs).toHaveLength(1)
  })
})
