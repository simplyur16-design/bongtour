import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModetourB2cApiError } from '@/lib/modetour-sd1-policy'
import {
  collectModetourPriceInputsWithE2eFallback,
} from '@/lib/modetour-price-collect'

const scrapeLiveCalendar = vi.fn()
const collectModetourDepartureInputsForDateRange = vi.fn()
const fetchModetourGroupDetailInfo = vi.fn()
const resolveModetourDetailByOriginCode = vi.fn()
vi.mock('@/lib/admin-departure-rescrape', () => ({
  scrapeLiveCalendar: (...args: unknown[]) => scrapeLiveCalendar(...args),
  mapScrapedRowsToInputs: (
    rows: Array<{
      date?: string
      adultPrice?: number
      price?: number
    }>,
    _statusByDate: Map<string, unknown>,
  ) =>
    rows.map((r) => ({
      departureDate: r.date,
      adultPrice: r.adultPrice ?? r.price,
    })),
}))
vi.mock('@/lib/modetour-origin-code-resolve', () => ({
  resolveModetourDetailByOriginCode: (...args: unknown[]) =>
    resolveModetourDetailByOriginCode(...args),
}))
vi.mock('@/lib/modetour-departures', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/modetour-departures')>()
  return {
    ...actual,
    collectModetourDepartureInputsForDateRange: (...args: unknown[]) =>
      collectModetourDepartureInputsForDateRange(...args),
    fetchModetourGroupDetailInfo: (...args: unknown[]) => fetchModetourGroupDetailInfo(...args),
  }
})

describe('collectModetourPriceInputsWithE2eFallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    scrapeLiveCalendar.mockReset()
    collectModetourDepartureInputsForDateRange.mockReset()
    fetchModetourGroupDetailInfo.mockReset()
    resolveModetourDetailByOriginCode.mockReset()
    resolveModetourDetailByOriginCode.mockImplementation(async (_code, opts) => {
      const storedNo = (opts?.storedOriginUrl ?? '').match(/\/package\/(\d+)/)?.[1] ?? null
      return {
        originCode: '',
        productNo: storedNo,
        detailUrl: storedNo ? `https://www.modetour.com/package/${storedNo}` : opts?.storedOriginUrl ?? null,
        source: storedNo ? 'stored-origin-url' : 'unresolved',
      }
    })
    global.fetch = vi.fn() as typeof fetch
  })

  it('returns API rows when priced departures exist', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: [{ departureDate: '2026-07-01', minPrice: 1200000, pId: 99 }],
      }),
    } as Response)

    const out = await collectModetourPriceInputsWithE2eFallback(
      'https://www.modetour.com/package/12345',
      '2026-06-16',
      '2026-12-13',
    )

    expect(out.source).toBe('api')
    expect(out.inputs).toHaveLength(1)
    expect(out.e2eAttempted).toBe(false)
    expect(scrapeLiveCalendar).not.toHaveBeenCalled()
  })

  it('falls back to E2E on SD1 and returns scraped prices', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          errorMessages: [{ errorCode: '상품이 존재하지 않습니다. [SD1]' }],
          isOK: false,
        }),
    } as Response)

    scrapeLiveCalendar.mockResolvedValueOnce({
      rows: [{ date: '2026-08-01', adultPrice: 990000 }],
      stderr: '',
    })

    const out = await collectModetourPriceInputsWithE2eFallback(
      'https://www.modetour.com/package/12345',
      '2026-06-16',
      '2026-12-13',
    )

    expect(out.apiFailedSd1).toBe(true)
    expect(out.source).toBe('e2e')
    expect(out.inputs).toHaveLength(1)
    expect(out.inputs[0]?.adultPrice).toBe(990000)
    expect(scrapeLiveCalendar).toHaveBeenCalledTimes(1)
  })

  it('falls back to E2E on SD2 and returns scraped prices', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          errorMessages: [{ errorCode: '상품이 존재하지 않습니다. [SD2]' }],
          isOK: false,
        }),
    } as Response)

    scrapeLiveCalendar.mockResolvedValueOnce({
      rows: [{ date: '2026-08-15', adultPrice: 880000 }],
      stderr: '',
    })

    const out = await collectModetourPriceInputsWithE2eFallback(
      'https://www.modetour.com/package/12345',
      '2026-06-16',
      '2026-12-13',
    )

    expect(out.apiFailedSd1).toBe(true)
    expect(out.source).toBe('e2e')
    expect(out.inputs).toHaveLength(1)
    expect(scrapeLiveCalendar).toHaveBeenCalledTimes(1)
  })

  it('marks e2eModalOpenFailed when stderr reports modal open failure', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          errorMessages: [{ errorCode: '상품이 존재하지 않습니다. [SD1]' }],
          isOK: false,
        }),
    } as Response)

    scrapeLiveCalendar.mockResolvedValueOnce({
      rows: [],
      stderr: '[modetour-modal] phase=modetour-open failed',
    })

    const out = await collectModetourPriceInputsWithE2eFallback(
      'https://www.modetour.com/package/12345',
      '2026-06-16',
      '2026-12-13',
    )

    expect(out.e2eAttempted).toBe(true)
    expect(out.e2eModalOpenFailed).toBe(true)
    expect(out.inputs).toHaveLength(0)
  })

  it('falls back to E2E when API returns zero priced rows', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: [{ departureDate: '2026-07-01', minPrice: 0 }],
      }),
    } as Response)

    scrapeLiveCalendar.mockResolvedValueOnce({
      rows: [{ date: '2026-07-15', adultPrice: 1100000 }],
      stderr: '',
    })

    const out = await collectModetourPriceInputsWithE2eFallback(
      'https://www.modetour.com/package/12345',
      '2026-06-16',
      '2026-12-13',
    )

    expect(out.source).toBe('e2e')
    expect(out.inputs).toHaveLength(1)
  })

  it('airHotel uses GetProductDetailInfo group row when calendar API is SD1', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          errorMessages: [{ errorCode: '상품이 존재하지 않습니다. [SD1]' }],
          isOK: false,
        }),
    } as Response)

    fetchModetourGroupDetailInfo.mockResolvedValueOnce({
      groupNumber: 102323588,
      departureDate: '2026-08-01',
      sellingPriceAdultTotalAmount: 579900,
    })

    const out = await collectModetourPriceInputsWithE2eFallback(
      'https://www.modetour.com/package/102323588',
      '2026-06-16',
      '2026-12-13',
      { airHotel: true, originCode: 'ADA920TWB4' },
    )

    expect(out.source).toBe('api')
    expect(out.inputs).toHaveLength(1)
    expect(out.inputs[0]?.adultPrice).toBe(579900)
    expect(out.e2eAttempted).toBe(false)
    expect(scrapeLiveCalendar).not.toHaveBeenCalled()
    expect(collectModetourDepartureInputsForDateRange).not.toHaveBeenCalled()
  })

  it('airHotel uses full API collector when lightweight returns zero rows', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: [] }),
    } as Response)
    collectModetourDepartureInputsForDateRange.mockResolvedValueOnce([
      { departureDate: '2026-09-01', adultPrice: 550000, seatsStatusRaw: '잔여3' },
    ])

    const out = await collectModetourPriceInputsWithE2eFallback(
      'https://go.modetour.co.kr/package/99999',
      '2026-06-16',
      '2026-12-13',
      { airHotel: true },
    )

    expect(out.source).toBe('api')
    expect(out.inputs).toHaveLength(1)
    expect(out.inputs[0]?.adultPrice).toBe(550000)
    expect(collectModetourDepartureInputsForDateRange).toHaveBeenCalledWith(
      'https://www.modetour.com/package/99999',
      '2026-06-16',
      '2026-12-13',
      { skipBaselineMatch: true },
    )
    expect(scrapeLiveCalendar).not.toHaveBeenCalled()
  })

  it('rethrows non-SD1 API errors without E2E', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => 'unavailable',
    } as Response)

    await expect(
      collectModetourPriceInputsWithE2eFallback(
        'https://www.modetour.com/package/12345',
        '2026-06-16',
        '2026-12-13',
      ),
    ).rejects.toBeInstanceOf(ModetourB2cApiError)

    expect(scrapeLiveCalendar).not.toHaveBeenCalled()
  })
})
