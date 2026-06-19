import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectYbtourPriceInputsWithE2eFallback } from '@/lib/ybtour-price-collect'

const collectYbtourByGoodsApiDepartureInputsForUrl = vi.fn()
const collectYbtourE2eDepartureInputsForDateRange = vi.fn()

vi.mock('@/lib/ybtour-api-departures', () => ({
  collectYbtourByGoodsApiDepartureInputsForUrl: (...args: unknown[]) =>
    collectYbtourByGoodsApiDepartureInputsForUrl(...args),
}))

vi.mock('@/lib/admin-departure-rescrape', () => ({
  collectYbtourE2eDepartureInputsForDateRange: (...args: unknown[]) =>
    collectYbtourE2eDepartureInputsForDateRange(...args),
}))

describe('collectYbtourPriceInputsWithE2eFallback', () => {
  beforeEach(() => {
    collectYbtourByGoodsApiDepartureInputsForUrl.mockReset()
    collectYbtourE2eDepartureInputsForDateRange.mockReset()
  })

  it('returns by-goods api rows without E2E when API has priced departures', async () => {
    collectYbtourByGoodsApiDepartureInputsForUrl.mockResolvedValueOnce({
      inputs: [
        { departureDate: '2026-07-03', adultPrice: 2690000 },
        { departureDate: '2026-07-10', adultPrice: 2790000 },
      ],
      goodsCd: 'EEP1284',
      goodsCdFromUrl: 'EEP1284',
      dspSid: 'AABF011',
      seedEvCd: 'EEP1284-260703LO01',
      monthKeys: ['202607'],
      rawRowCount: 2,
      evCdPriceEnriched: true,
    })

    const out = await collectYbtourPriceInputsWithE2eFallback(
      'https://prdt.ybtour.co.kr/product/detailPackage?goodsCd=EEP1284&evCd=EEP1284-260703LO01',
      'EEP1284',
      '2026-07-01',
      '2026-07-31',
    )

    expect(out.source).toBe('api')
    expect(out.e2eAttempted).toBe(false)
    expect(out.inputs).toHaveLength(2)
    expect(collectYbtourByGoodsApiDepartureInputsForUrl).toHaveBeenCalledWith(
      'https://prdt.ybtour.co.kr/product/detailPackage?goodsCd=EEP1284&evCd=EEP1284-260703LO01',
      '2026-07-01',
      '2026-07-31',
      expect.objectContaining({ originCode: 'EEP1284' }),
    )
    expect(collectYbtourE2eDepartureInputsForDateRange).not.toHaveBeenCalled()
  })

  it('passes originCode for evCd-shaped goodsCd normalization', async () => {
    collectYbtourByGoodsApiDepartureInputsForUrl.mockResolvedValueOnce({
      inputs: [{ departureDate: '2026-07-11', adultPrice: 719900 }],
      goodsCd: 'AVP4484',
      goodsCdFromUrl: 'AVP4484-260711RS00',
      dspSid: 'AABF011',
      seedEvCd: 'AVP4484-260711RS00',
      monthKeys: ['202607'],
      rawRowCount: 1,
      evCdPriceEnriched: true,
    })

    await collectYbtourPriceInputsWithE2eFallback(
      'https://prdt.ybtour.co.kr/product/detailPackage?goodsCd=AVP4484-260711RS00&evCd=AVP4484-260711RS00',
      'AVP4484',
      '2026-07-01',
      '2026-07-31',
    )

    expect(collectYbtourByGoodsApiDepartureInputsForUrl).toHaveBeenCalledWith(
      expect.any(String),
      '2026-07-01',
      '2026-07-31',
      expect.objectContaining({ originCode: 'AVP4484' }),
    )
  })

  it('falls back to E2E when by-goods API returns no priced rows in window', async () => {
    collectYbtourByGoodsApiDepartureInputsForUrl.mockResolvedValueOnce({
      inputs: [],
      goodsCd: 'EEP1284',
      goodsCdFromUrl: 'EEP1284',
      dspSid: 'AABF011',
      seedEvCd: 'EEP1284-260703LO01',
      monthKeys: ['202608'],
      rawRowCount: 0,
      evCdPriceEnriched: false,
    })
    collectYbtourE2eDepartureInputsForDateRange.mockResolvedValueOnce([
      { departureDate: '2026-08-01', adultPrice: 1200000 },
    ])

    const out = await collectYbtourPriceInputsWithE2eFallback(
      'https://prdt.ybtour.co.kr/product/detailPackage?goodsCd=EEP1284',
      'EEP1284',
      '2026-08-01',
      '2026-08-31',
    )

    expect(out.source).toBe('e2e')
    expect(out.e2eAttempted).toBe(true)
    expect(out.inputs).toHaveLength(1)
  })
})
