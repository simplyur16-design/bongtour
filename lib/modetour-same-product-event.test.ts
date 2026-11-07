import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/admin-departure-rescrape', () => ({
  scrapeLiveCalendar: vi.fn(async () => ({ rows: [], stderr: '' })),
  mapScrapedRowsToInputs: vi.fn(() => []),
}))

import { scrapeLiveCalendar } from '@/lib/admin-departure-rescrape'
import { collectModetourPriceInputsWithE2eFallback } from '@/lib/modetour-price-collect'
import {
  lookupModetourSameProductFutureDepartures,
  modetourCalendarNeedsSameProductLookup,
  modetourEventIdentityFromDetail,
  verifyModetourSameProductEvent,
  type ModetourSameProductCalendar,
} from '@/lib/modetour-same-product-event'
import { parseVerygoodProCodeMasterCode } from '@/lib/verygoodtour-calendar-hxr'
import { pickVerygoodCalendarJsonRowsForTripDuration } from '@/lib/verygoodtour-price-collect'
import type { DepartureInput } from '@/lib/upsert-product-departures-modetour'

const fixture = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../tests/fixtures/stale-event-collect/cases.json'),
    'utf8',
  ),
) as {
  windowStartYmd: string
  modetour: Array<{
    productId: string
    storedProductNo: string
    liveProductNo: string
    productCode2: string
    productName: string
    departureDate: string
    supplierAdultPrice: number
  }>
  verygoodtour: Array<{
    productId: string
    seedProCode: string
    liveProCode: string
    masterCode: string
    departureDate: string
    supplierAdultPrice: number
    tourNights: number
    tourDays: number
  }>
}

const WINDOW_END = '2027-05-06'

function detailOf(row: (typeof fixture.modetour)[number], productName = row.productName, productCode2 = row.productCode2) {
  return {
    productCode2,
    productName,
    groupName: productName,
    nightCount: 4,
    dayCount: 6,
    departureDate: '2025-10-01',
    scheduleItemList: [{ dayNo: 1, title: '인천 출발' }],
  }
}

function supplierRow(date: string, adultPrice: number, productNo: string): DepartureInput {
  return {
    departureDate: date,
    adultPrice,
    supplierDepartureCodeCandidate: `modetour:${productNo}`,
  }
}

describe('modetour same-product check', () => {
  it('rejects a different product code, name, itinerary, or duration', () => {
    const base = modetourEventIdentityFromDetail('1', detailOf(fixture.modetour[0]!))
    const otherNo = { ...base, productNo: '2' }
    expect(verifyModetourSameProductEvent(base, otherNo).ok).toBe(true)
    expect(verifyModetourSameProductEvent(base, { ...otherNo, productCode2: 'OTHERCODE' })).toEqual({
      ok: false,
      reason: 'product_code2_mismatch',
    })
    expect(verifyModetourSameProductEvent(base, { ...otherNo, productName: '다른 상품' })).toEqual({
      ok: false,
      reason: 'product_name_mismatch',
    })
    expect(verifyModetourSameProductEvent(base, { ...otherNo, itineraryKey: '1:다른 일정' })).toEqual({
      ok: false,
      reason: 'itinerary_mismatch',
    })
    expect(verifyModetourSameProductEvent(base, { ...otherNo, durationKey: '9n10d' })).toEqual({
      ok: false,
      reason: 'duration_mismatch',
    })
    expect(verifyModetourSameProductEvent(base, { ...otherNo, productName: null })).toEqual({
      ok: false,
      reason: 'missing_product_name',
    })
  })

  it('looks up only on SD1 or an all-past calendar, not on a live registered calendar', () => {
    expect(
      modetourCalendarNeedsSameProductLookup({
        singleDeparture: false,
        sd1: false,
        departureDates: ['2026-11-11'],
        windowStartYmd: fixture.windowStartYmd,
      }),
    ).toBe(false)
    expect(
      modetourCalendarNeedsSameProductLookup({
        singleDeparture: false,
        sd1: true,
        departureDates: [],
        windowStartYmd: fixture.windowStartYmd,
      }),
    ).toBe(true)
    expect(
      modetourCalendarNeedsSameProductLookup({
        singleDeparture: false,
        sd1: false,
        departureDates: ['2025-01-01'],
        windowStartYmd: fixture.windowStartYmd,
      }),
    ).toBe(true)
    expect(
      modetourCalendarNeedsSameProductLookup({
        singleDeparture: false,
        sd1: false,
        departureDates: [],
        windowStartYmd: fixture.windowStartYmd,
      }),
    ).toBe(false)
    expect(
      modetourCalendarNeedsSameProductLookup({
        singleDeparture: true,
        sd1: true,
        departureDates: [],
        windowStartYmd: fixture.windowStartYmd,
      }),
    ).toBe(false)
  })

  it('uses the live event price only when the fixture product is the same', async () => {
    for (const row of fixture.modetour) {
      const skips: string[] = []
      const hit = await lookupModetourSameProductFutureDepartures({
        storedProductNo: row.storedProductNo,
        fromYmd: fixture.windowStartYmd,
        toYmd: WINDOW_END,
        deps: {
          fetchDetail: async (productNo) => detailOf(row),
          resolveCurrentProductNo: async (code) => (code === row.productCode2 ? row.liveProductNo : null),
          fetchCalendar: async (productNo) => {
            expect(productNo).toBe(row.liveProductNo)
            return {
              sd1: false,
              inputs: [supplierRow(row.departureDate, row.supplierAdultPrice, productNo)],
            } satisfies ModetourSameProductCalendar
          },
          logSkip: (reason) => skips.push(reason),
        },
      })
      expect(skips, row.productId).toEqual([])
      expect(hit?.productNo, row.productId).toBe(row.liveProductNo)
      expect(hit?.detailUrl, row.productId).toBe(`https://www.modetour.com/package/${row.liveProductNo}`)
      expect(hit?.inputs, row.productId).toEqual([
        supplierRow(row.departureDate, row.supplierAdultPrice, row.liveProductNo),
      ])

      const wrongPrice = row.supplierAdultPrice + 999
      const rejected = await lookupModetourSameProductFutureDepartures({
        storedProductNo: row.storedProductNo,
        fromYmd: fixture.windowStartYmd,
        toYmd: WINDOW_END,
        deps: {
          fetchDetail: async (productNo) =>
            detailOf(row, productNo === row.liveProductNo ? '다른 상품' : row.productName),
          resolveCurrentProductNo: async () => row.liveProductNo,
          fetchCalendar: async () => {
            throw new Error('different product must not be priced')
          },
          logSkip: (reason) => skips.push(reason),
        },
      })
      expect(rejected, row.productId).toBeNull()
      expect(skips, row.productId).toContain('product_name_mismatch')
      expect(JSON.stringify(rejected)).not.toContain(String(wrongPrice))
    }
  })
})

const realFetch = globalThis.fetch

function httpResult(status: number, body: unknown, location?: string) {
  const text = JSON.stringify(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'location' ? location ?? null : null) },
    text: async () => text,
    json: async () => body,
  }
}

const sd1Body = {
  errorMessages: [{ errorCode: '상품이 존재하지 않습니다. [SD1]', errorMessage: '상품이 존재하지 않습니다. [SD1]' }],
  isOK: false,
}

describe('collect path for a stale modetour event', () => {
  afterEach(() => {
    globalThis.fetch = realFetch
    vi.mocked(scrapeLiveCalendar).mockClear()
  })

  it('keeps a registered product on its current number when the calendar already has a future price', async () => {
    const calls: string[] = []
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      expect(url).toContain('GetOtherDepartureDates')
      expect(url).toContain('productNo=107812951')
      return httpResult(200, {
        isOK: true,
        result: [{ departureDate: '2026-11-11', minPrice: 1102750, pId: 107812951 }],
      }) as unknown as Response
    }) as typeof fetch

    const result = await collectModetourPriceInputsWithE2eFallback(
      'https://www.modetour.com/package/107812951',
      fixture.windowStartYmd,
      WINDOW_END,
    )
    expect(calls).toHaveLength(1)
    expect(scrapeLiveCalendar).not.toHaveBeenCalled()
    expect(result.resolvedProductNo).toBe('107812951')
    expect(result.inputs.map((row) => row.adultPrice)).toEqual([1102750])
    expect(result.e2eAttempted).toBe(false)
  })

  it('pkg-mt-0275 SD1 adopts the same product live number and its supplier price', async () => {
    const row = fixture.modetour[0]!
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('GetOtherDepartureDates')) {
        const productNo = new URL(url).searchParams.get('productNo')
        if (productNo === row.storedProductNo) return httpResult(400, sd1Body) as unknown as Response
        if (productNo === row.liveProductNo) {
          return httpResult(200, {
            isOK: true,
            result: [{ departureDate: row.departureDate, minPrice: row.supplierAdultPrice, pId: Number(row.liveProductNo) }],
          }) as unknown as Response
        }
      }
      if (url.includes('GetProductDetailInfo')) {
        return httpResult(200, { result: detailOf(row) }) as unknown as Response
      }
      if (url.includes(`/package/${row.productCode2}`)) {
        return httpResult(302, {}, `https://www.modetour.com/package/${row.liveProductNo}`) as unknown as Response
      }
      throw new Error(`unexpected fetch ${url}`)
    }) as typeof fetch

    const result = await collectModetourPriceInputsWithE2eFallback(
      `https://www.modetour.com/package/${row.storedProductNo}`,
      fixture.windowStartYmd,
      WINDOW_END,
    )
    expect(scrapeLiveCalendar).not.toHaveBeenCalled()
    expect(result.resolvedProductNo).toBe(row.liveProductNo)
    expect(result.resolvedDetailUrl).toBe(`https://www.modetour.com/package/${row.liveProductNo}`)
    expect(result.detailResolveSource).toBe('origin-code-redirect')
    expect(result.inputs).toEqual([
      {
        departureDate: row.departureDate,
        adultPrice: row.supplierAdultPrice,
        supplierDepartureCodeCandidate: `modetour:${row.liveProductNo}`,
        localPriceText: `modetour:pId=${row.liveProductNo}`,
      },
    ])
  })

  it('does not replace the number when the live page is a different product', async () => {
    const row = fixture.modetour[0]!
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('GetOtherDepartureDates') && url.includes(row.storedProductNo)) {
        return httpResult(400, sd1Body) as unknown as Response
      }
      if (url.includes('GetProductDetailInfo')) {
        const productNo = new URL(url).searchParams.get('productNo')
        const name = productNo === row.liveProductNo ? '다른 상품' : row.productName
        return httpResult(200, { result: detailOf(row, name) }) as unknown as Response
      }
      if (url.includes(`/package/${row.productCode2}`)) {
        return httpResult(302, {}, `https://www.modetour.com/package/${row.liveProductNo}`) as unknown as Response
      }
      throw new Error(`unexpected fetch ${url}`)
    }) as typeof fetch

    const result = await collectModetourPriceInputsWithE2eFallback(
      `https://www.modetour.com/package/${row.storedProductNo}`,
      fixture.windowStartYmd,
      WINDOW_END,
    )
    expect(scrapeLiveCalendar).toHaveBeenCalled()
    expect(result.inputs).toEqual([])
    expect(result.resolvedProductNo).toBe(row.storedProductNo)
  })

  it('leaves an empty non-SD1 calendar on the existing path', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      expect(url).toContain('GetOtherDepartureDates')
      return httpResult(200, { isOK: true, result: [] }) as unknown as Response
    }) as typeof fetch

    const result = await collectModetourPriceInputsWithE2eFallback(
      'https://www.modetour.com/package/107812951',
      fixture.windowStartYmd,
      WINDOW_END,
    )
    expect(scrapeLiveCalendar).toHaveBeenCalled()
    expect(result.resolvedProductNo).toBe('107812951')
    expect(result.inputs).toEqual([])
  })
})

describe('verygoodtour master calendar keeps the live ProCode price', () => {
  it('pkg-vg-0045 and pkg-vg-0039 use the master prefix and the fixture supplier price', () => {
    for (const row of fixture.verygoodtour) {
      expect(parseVerygoodProCodeMasterCode(row.seedProCode), row.productId).toBe(row.masterCode)
      expect(parseVerygoodProCodeMasterCode(row.liveProCode), row.productId).toBe(row.masterCode)
      const picked = pickVerygoodCalendarJsonRowsForTripDuration(
        [
          {
            date: '2020-01-01',
            returnDate: null,
            proCode: row.seedProCode,
            tourNights: row.tourNights,
            tourDays: row.tourDays,
            travelPeriodText: null,
            adultPrice: 1,
            statusRaw: null,
            productName: row.productId,
            carrierText: null,
            minPax: null,
          },
          {
            date: row.departureDate,
            returnDate: null,
            proCode: row.liveProCode,
            tourNights: row.tourNights,
            tourDays: row.tourDays,
            travelPeriodText: null,
            adultPrice: row.supplierAdultPrice,
            statusRaw: null,
            productName: row.productId,
            carrierText: null,
            minPax: null,
          },
          {
            date: row.departureDate,
            returnDate: null,
            proCode: `${row.masterCode}-999999ZZ`,
            tourNights: row.tourNights,
            tourDays: row.tourDays,
            travelPeriodText: null,
            adultPrice: row.supplierAdultPrice + 999,
            statusRaw: null,
            productName: '다른 접미',
            carrierText: null,
            minPax: null,
          },
          {
            date: '2026-11-20',
            returnDate: null,
            proCode: `${row.masterCode}-261120ET13`,
            tourNights: row.tourNights + 2,
            tourDays: row.tourDays + 2,
            travelPeriodText: null,
            adultPrice: 50,
            statusRaw: null,
            productName: '다른 기간',
            carrierText: null,
            minPax: null,
          },
        ],
        { nights: row.tourNights, days: row.tourDays },
        row.seedProCode,
      )
      const future = picked.inputs.filter((item) => String(item.departureDate) >= fixture.windowStartYmd)
      expect(future.map((item) => item.departureDate), row.productId).toEqual([row.departureDate])
      expect(future.map((item) => item.adultPrice), row.productId).toEqual([row.supplierAdultPrice])
      expect(picked.droppedMismatch, row.productId).toBe(1)
    }
  })
})
