import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectHanatourPriceInputsWithE2eFallback } from '@/lib/hanatour-price-collect'

const collectHanatourApiDepartureInputsForMonths = vi.fn()
const collectHanatourDepartureInputs = vi.fn()

vi.mock('@/lib/hanatour-api-departures', () => ({
  parseHanatourPkgCdFromUrl: (url: string) => url.match(/pkgCd=([^&]+)/)?.[1] ?? null,
  collectHanatourApiDepartureInputsForMonths: (...args: unknown[]) =>
    collectHanatourApiDepartureInputsForMonths(...args),
}))

vi.mock('@/lib/hanatour-departures', () => ({
  collectHanatourDepartureInputs: (...args: unknown[]) => collectHanatourDepartureInputs(...args),
}))

describe('collectHanatourPriceInputsWithE2eFallback', () => {
  beforeEach(() => {
    collectHanatourApiDepartureInputsForMonths.mockReset()
    collectHanatourDepartureInputs.mockReset()
  })

  it('returns api rows without E2E when API has priced departures', async () => {
    collectHanatourApiDepartureInputsForMonths.mockResolvedValueOnce({
      inputs: [{ departureDate: '2026-06-30', adultPrice: 881900 }],
      airtelLike: false,
    })

    const out = await collectHanatourPriceInputsWithE2eFallback(
      'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=ATP207260601TWJ',
      '2026-06-01',
      '2026-12-31',
      { monthYms: ['2026-06'] },
    )

    expect(out.source).toBe('api')
    expect(out.e2eAttempted).toBe(false)
    expect(out.inputs).toHaveLength(1)
    expect(collectHanatourDepartureInputs).not.toHaveBeenCalled()
  })

  it('falls back to E2E when API returns zero priced rows', async () => {
    collectHanatourApiDepartureInputsForMonths.mockResolvedValueOnce({
      inputs: [],
      airtelLike: true,
    })
    collectHanatourDepartureInputs.mockResolvedValueOnce({
      inputs: [{ departureDate: '2026-07-06', adultPrice: 799000 }],
      meta: { notes: [] },
    })

    const out = await collectHanatourPriceInputsWithE2eFallback(
      'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=AAB261260706FDB',
      '2026-07-01',
      '2026-12-31',
      { monthYms: ['2026-07'] },
    )

    expect(out.source).toBe('e2e')
    expect(out.e2eAttempted).toBe(true)
    expect(out.inputs[0]?.adultPrice).toBe(799000)
  })
})
