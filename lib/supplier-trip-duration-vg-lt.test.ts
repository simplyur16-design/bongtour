/**
 * 참좋은(verygoodtour)·롯데(lottetour) 달력 기간 섞임 — 상품 기간(박·일)이 같은 출발만 남기는지.
 * 실제 응답 fixture, 네트워크 없음:
 * - scripts/fixtures/verygoodtour-app9074-calendar-202611.html (APP9074 2026-11 ProductCalendarSearch, 3박5일·4박6일 섞임)
 *   sha256 8d756d46c952be5bfe3ab80273d74e261ecc16b28277e4b98050c530d1586b7c
 * - scripts/fixtures/lottetour-evtListAjax-65530-202611.html (godId 65530 2026-11, 3박4일·4박5일 섞임)
 *   sha256 0450ba7c4a8eadf65791a8a69363a12d52b57d1da0e82472ea9954da6f60e88c
 * - scripts/fixtures/lottetour-evtListAjax-60675-202701.html (godId 60675 2027-01, 6박8일만 — 상품 7박9일)
 *   sha256 e21c64b239d3ba3ac59285d8585435957e9970ce8d36b30b9a03008349567b2c
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseVerygoodCalendarProductListJson, verygoodProCodeSuffix } from './verygoodtour-calendar-hxr'
import {
  collectVerygoodHxrOnlyForDateRange,
  collectVerygoodtourPriceInputsWithE2eFallback,
  pickVerygoodCalendarJsonRowsForTripDuration,
} from './verygoodtour-price-collect'
import { collectLottetourCalendarRange, filterLottetourCalendarRowsByTripDuration } from './lottetour-departures'
import { collectLottetourPriceInputsWithE2eFallback } from './lottetour-price-collect'
import { pickLottetourDepartureForSameDate } from './lottetour-same-date-departure-pick'
import { resolveSupplierProductTripDuration, supplierTripDurationFromNumbers } from './supplier-trip-duration'

const fx = (name: string) => fs.readFileSync(path.join(__dirname, '..', 'scripts', 'fixtures', name), 'utf8')
const VG_CAL = fx('verygoodtour-app9074-calendar-202611.html')
const LT_65530 = fx('lottetour-evtListAjax-65530-202611.html')
const LT_60675 = fx('lottetour-evtListAjax-60675-202701.html')

const VG_0104_URL = 'https://www.verygoodtour.com/Product/PackageDetail?ProCode=APP9074-2610267C46&PriceSeq=1&MenuCode=106'
const VG_0100_URL = 'https://www.verygoodtour.com/Product/PackageDetail?ProCode=APP9074-2610247C35&PriceSeq=1&MenuCode=106'

function stubVerygoodFetch() {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown) => {
      const u = String(url)
      calls.push(u)
      if (u.includes('ProductCalendarSearch')) {
        const html = u.includes('Month=11') && u.includes('Year=2026') ? VG_CAL : '<html></html>'
        return new Response(html, { status: 200 })
      }
      return new Response('<script>var MenuCode = "106";</script>', { status: 200 })
    }),
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('공통 기간 도우미', () => {
  it('상품 기간·숫자 박일', () => {
    expect(resolveSupplierProductTripDuration({ duration: '4박 6일' })).toEqual({ nights: 4, days: 6 })
    expect(resolveSupplierProductTripDuration({ duration: null, tripNights: null, tripDays: null })).toBeNull()
    expect(supplierTripDurationFromNumbers(3, 5)).toEqual({ nights: 3, days: 5 })
    expect(supplierTripDurationFromNumbers(null, 5)).toBeNull()
  })
})

describe('verygoodtour — APP9074 2026-11 실제 달력', () => {
  it('fixture 전제: $calendarProductListJson 43행, 3박5일 37 · 4박6일 6', () => {
    const rows = parseVerygoodCalendarProductListJson(VG_CAL)!
    expect(rows).toHaveLength(43)
    expect(rows.filter((r) => r.tourNights === 3 && r.tourDays === 5)).toHaveLength(37)
    expect(rows.filter((r) => r.tourNights === 4 && r.tourDays === 6)).toHaveLength(6)
    expect(verygoodProCodeSuffix('APP9074-2611027C46')).toBe('7C46')
    expect(parseVerygoodCalendarProductListJson('<html>no json</html>')).toBeNull()
  })

  it('상품 4박6일(vg-0104): 4박6일 판매중 5건만, 가격은 응답 AdultPrice 그대로', () => {
    const rows = parseVerygoodCalendarProductListJson(VG_CAL)!
    const r = pickVerygoodCalendarJsonRowsForTripDuration(rows, { nights: 4, days: 6 }, 'APP9074-2610267C46')
    expect(r.inputs.map((x) => [x.departureDate, x.adultPrice])).toEqual([
      ['2026-11-02', 1129000],
      ['2026-11-15', 1099000],
      ['2026-11-16', 1099000],
      ['2026-11-28', 1119000],
      ['2026-11-29', 1119000],
    ])
    expect(r.droppedMismatch).toBe(37)
    expect(r.droppedClosed).toBe(1) // 11/08 7C46 예약마감
  })

  it('상품 3박5일(vg-0100): 같은 날짜는 시드 접미(7C35) 우선, 4박6일 가격이 이기지 않음', () => {
    const rows = parseVerygoodCalendarProductListJson(VG_CAL)!
    const r = pickVerygoodCalendarJsonRowsForTripDuration(rows, { nights: 3, days: 5 }, 'APP9074-2610247C35')
    expect(r.inputs).toHaveLength(24)
    const by = new Map(r.inputs.map((x) => [x.departureDate as string, x.adultPrice]))
    expect(by.get('2026-11-02')).toBeUndefined() // 3박5일은 BX35 예약마감뿐 — 4박6일 1,129,000 이 들어가지 않음
    expect(by.get('2026-11-05')).toBe(1069000) // 7C35 1,069,000 (BX35 1,091,000 아님)
    expect(by.get('2026-11-12')).toBe(1159000) // 7C35 대기예약 우선(BX35 1,111,000 보다 비싸도 같은 상품코드 우선)
    expect(by.get('2026-11-07')).toBe(1051000) // 7C35 없는 날 → 같은 기간 최저가
    expect(by.get('2026-11-16')).toBe(1051000) // 같은 날 4박6일 1,099,000 은 빠짐
    expect(r.droppedMismatch).toBe(6)
  })

  it('collectVerygoodHxrOnlyForDateRange: 기간 주면 JSON 행으로 거름, 모르면 지금 동작(좌측 칸) + 섞임 경고', async () => {
    stubVerygoodFetch()
    const withDur = await collectVerygoodHxrOnlyForDateRange(VG_0104_URL, '2026-11-01', '2026-11-30', {
      expectedTripDuration: { nights: 4, days: 6 },
    })
    expect(withDur.durationFilterApplied).toBe(true)
    expect(withDur.inputs.map((x) => x.departureDate)).toEqual([
      '2026-11-02',
      '2026-11-15',
      '2026-11-16',
      '2026-11-28',
      '2026-11-29',
    ])
    expect(withDur.warnings.some((w) => w.includes('다른 출발 37건 제외'))).toBe(true)

    const noDur = await collectVerygoodHxrOnlyForDateRange(VG_0104_URL, '2026-11-01', '2026-11-30')
    expect(noDur.durationFilterApplied).toBe(false)
    expect(noDur.inputs.length).toBeGreaterThan(withDur.inputs.length)
    expect(noDur.warnings.some((w) => w.includes('기간 섞임 경고'))).toBe(true)
  })

  it('같은 기간 출발 0건이면 E2E(기간 구분 못 함) 생략, 판매종료로 보지 않음', async () => {
    const calls = stubVerygoodFetch()
    const r = await collectVerygoodtourPriceInputsWithE2eFallback(VG_0100_URL, '2026-11-01', '2026-11-30', {
      skipExpiredCheck: true,
      expectedTripDuration: { nights: 5, days: 7 },
    })
    expect(r.inputs).toHaveLength(0)
    expect(r.e2eAttempted).toBe(false)
    expect(r.horizonSoldOut).toBe(false)
    expect(calls.some((u) => u.includes('ProductCalendarSearch'))).toBe(true)
  })
})

describe('lottetour — 실제 evtListAjax', () => {
  const LT_0097 = { godId: '65530', menuNos: ['848', '1296', '4545', '4551'] as const }

  it('상품 4박5일(lt-0097): 같은 godId 의 3박4일 출발 제외', async () => {
    const r = await collectLottetourCalendarRange(LT_0097, {
      monthCount: 1,
      dateFrom: '2026-11',
      htmlByDepYm: new Map([['202611', LT_65530]]),
      expectedTripDuration: { nights: 4, days: 5 },
    })
    expect(r.rows.map((x) => [x.evtCd, x.durationText, x.adultPrice])).toEqual([
      ['C26D261103KE003', '4박5일', 3700000],
      ['C26D261104KE003', '4박5일', 3860000],
      ['C26D261105KE003', '4박5일', 4020000],
    ])
    expect(r.durationStats?.droppedMismatch).toBe(3)
    expect(r.warnings.some((w) => w.includes('다른 출발 3건 제외'))).toBe(true)
  })

  it('상품 기간 모름: 6건 그대로 + 섞임 경고', async () => {
    const r = await collectLottetourCalendarRange(LT_0097, {
      monthCount: 1,
      dateFrom: '2026-11',
      htmlByDepYm: new Map([['202611', LT_65530]]),
    })
    expect(r.rows).toHaveLength(6)
    expect(r.warnings.some((w) => w.includes('기간 섞임 경고'))).toBe(true)
  })

  it('같은 날짜 고르기: 상품 기간 일치 행 우선(더 싼 다른 기간 행이 이기지 않음)', () => {
    const a = { departureDate: '2026-11-03', adultPrice: 3270000, vehicleNote: '3박4일', supplierPriceKey: 'C26D261103KE002' }
    const b = { departureDate: '2026-11-03', adultPrice: 3700000, vehicleNote: '4박5일', supplierPriceKey: 'C26D261103KE003' }
    expect(pickLottetourDepartureForSameDate([a, b], null, { nights: 4, days: 5 }).supplierPriceKey).toBe('C26D261103KE003')
    expect(pickLottetourDepartureForSameDate([a, b], null).supplierPriceKey).toBe('C26D261103KE002')
  })

  it('응답이 전부 다른 기간(lt-0037: 상품 7박9일, 응답 6박8일) — 0건이지만 판매종료·E2E 아님', async () => {
    const rows = (
      await collectLottetourCalendarRange(
        { godId: '60675', menuNos: ['826', '854', '1000', '2798'] },
        { monthCount: 1, dateFrom: '2027-01', htmlByDepYm: new Map([['202701', LT_60675]]) },
      )
    ).rows
    expect(rows.length).toBeGreaterThan(0)
    expect(new Set(rows.map((x) => x.durationText))).toEqual(new Set(['6박8일']))
    expect(filterLottetourCalendarRowsByTripDuration(rows, { nights: 7, days: 9 }).rows).toHaveLength(0)

    vi.stubEnv('LOTTETOUR_E2E_FALLBACK', '0')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown) =>
        new Response(String(url).includes('depDt=202701') ? LT_60675 : '<table><tbody></tbody></table>', { status: 200 }),
      ),
    )
    const r = await collectLottetourPriceInputsWithE2eFallback(
      {
        godId: '60675',
        menuNos: ['826', '854', '1000', '2798'],
        detailEvtCd: 'E01A260723KE001',
        detailUrl: null,
        evtCdHint: 'E01A260723KE001',
      },
      'test-lt-0037',
      '2027-01-01',
      '2027-01-31',
      { expectedTripDuration: { nights: 7, days: 9 } },
    )
    expect(r.inputs).toHaveLength(0)
    expect(r.e2eAttempted).toBe(false)
    expect(r.horizonSoldOut).toBe(false)
    expect(r.warnings.some((w) => w.includes('상품 기간값 의심'))).toBe(true)
  })
})
