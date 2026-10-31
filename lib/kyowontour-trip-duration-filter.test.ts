/**
 * 교원이지 masterCode 기간 섞임(CTP221: 2박3일·3박4일) — 상품 기간(dN)으로만 출발을 남기는지.
 * 실제 응답 fixture(scripts/fixtures/kyowontour-ctp221-dayairlist-20261031.json), 네트워크 없음.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { collectKyowontourCalendarRange } from './kyowontour-departures'
import {
  parseKyowontourTripDurationLabel,
  resolveKyowontourProductTripDuration,
  shouldReplaceKyowontourSameDateRow,
} from './kyowontour-trip-duration-filter'

type DayAir = Record<string, unknown> & { departDateYmd: string; dN: string; tourCode: string; adultPrice: number }

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'scripts', 'fixtures', 'kyowontour-ctp221-dayairlist-20261031.json'), 'utf8'),
) as { masterCode: string; dayAirList: DayAir[] }

/** POST differentDepartDate 흉내: 날짜별 dayAirList(수집 순서 그대로) + 월초 seed 에 monthEvtList */
function mockDifferentDepartDate(list: DayAir[]) {
  return vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
    const body = new URLSearchParams(String(init?.body ?? ''))
    const ym = body.get('departMonth') ?? ''
    const ymd = body.get('departDate') ?? ''
    const dayAirList = list.filter((r) => r.departDateYmd === ymd)
    const monthEvtList = ymd.endsWith('01')
      ? [...new Set(list.filter((r) => r.departDateYmd.startsWith(ym)).map((r) => r.departDateYmd))].map((d) => ({
          departDateYmd: d,
        }))
      : []
    return new Response(JSON.stringify({ data: { dayAirList, monthEvtList } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
}

const OPTS = { startMonth: new Date(2026, 10, 1), monthCount: 5, disableE2EFallback: true, maxRetries: 1 }

describe('kyowontour 기간 파싱', () => {
  it('dN·duration 표기', () => {
    expect(parseKyowontourTripDurationLabel('2박3일')).toEqual({ nights: 2, days: 3 })
    expect(parseKyowontourTripDurationLabel('2박 3일')).toEqual({ nights: 2, days: 3 })
    expect(parseKyowontourTripDurationLabel('')).toBeNull()
    expect(resolveKyowontourProductTripDuration({ duration: '3박 4일' })).toEqual({ nights: 3, days: 4 })
    expect(resolveKyowontourProductTripDuration({ duration: '3박 4일', tripNights: 2, tripDays: 3 })).toEqual({
      nights: 2,
      days: 3,
    })
    expect(resolveKyowontourProductTripDuration({ duration: null })).toBeNull()
  })

  it('같은 날짜: 맞는 행을 dN 없는 행·다른 기간 행이 덮지 못함', () => {
    const exp = { nights: 2, days: 3 }
    expect(shouldReplaceKyowontourSameDateRow({ dN: '2박3일' }, { dN: '3박4일' }, exp)).toBe(false)
    expect(shouldReplaceKyowontourSameDateRow({ dN: '2박3일' }, {}, exp)).toBe(false)
    expect(shouldReplaceKyowontourSameDateRow({}, { dN: '2박3일' }, exp)).toBe(true)
    expect(shouldReplaceKyowontourSameDateRow({ dN: '2박3일' }, { dN: '3박4일' }, null)).toBe(true)
  })
})

describe('collectKyowontourCalendarRange — CTP221 실제 응답', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockDifferentDepartDate(fixture.dayAirList))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fixture 전제: 47행, 2박3일 12 · 3박4일 35, 11/06 은 TW02·TW03·TW01 세 행', () => {
    expect(fixture.masterCode).toBe('CTP221')
    expect(fixture.dayAirList).toHaveLength(47)
    expect(fixture.dayAirList.filter((r) => r.dN === '2박3일')).toHaveLength(12)
    expect(fixture.dayAirList.filter((r) => r.dN === '3박4일')).toHaveLength(35)
    expect(fixture.dayAirList.filter((r) => r.departDateYmd === '20261106').map((r) => r.tourCode)).toEqual([
      'CTP221261106TW02',
      'CTP221261106TW03',
      'CTP221261106TW01',
    ])
  })

  it('상품 2박3일: 2박3일 12건만 남고 11/06 은 TW02 999,000', async () => {
    const r = await collectKyowontourCalendarRange('CTP221', {
      ...OPTS,
      expectedTripDuration: { nights: 2, days: 3 },
    })
    expect(r.rows).toHaveLength(12)
    for (const row of r.rows) expect((row.rawJson as DayAir).dN).toBe('2박3일')
    const nov6 = r.rows.find((x) => x.departDate === '2026-11-06')
    expect(nov6?.tourCode).toBe('CTP221261106TW02')
    expect(nov6?.adultPriceFromCalendar).toBe(999000)
    // 같은 TW02 접미사여도 3박4일인 11/01 은 빠짐
    expect(r.rows.find((x) => x.departDate === '2026-11-01')).toBeUndefined()
    expect(r.warnings.some((w) => w.includes('기간 거름') && w.includes('35행'))).toBe(true)
  })

  it('상품 3박4일: 3박4일 출발만, 11/06 에 2박3일 999,000 이 들어가지 않음', async () => {
    const r = await collectKyowontourCalendarRange('CTP221', {
      ...OPTS,
      expectedTripDuration: { nights: 3, days: 4 },
    })
    for (const row of r.rows) expect((row.rawJson as DayAir).dN).toBe('3박4일')
    expect(r.rows.find((x) => x.departDate === '2026-11-06')?.adultPriceFromCalendar).not.toBe(999000)
    expect(r.rows.find((x) => x.departDate === '2026-11-02')?.tourCode).toBe('CTP221261102TW01')
  })

  it('상품 기간 모름: 지금 동작 그대로(날짜별 나중 행) + 섞임 경고', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = await collectKyowontourCalendarRange('CTP221', { ...OPTS, expectedTripDuration: null })
    const dates = new Set(fixture.dayAirList.map((x) => x.departDateYmd))
    expect(r.rows).toHaveLength(dates.size)
    // 기존 동작: 11/06 은 마지막 행(TW01 3박4일)
    expect(r.rows.find((x) => x.departDate === '2026-11-06')?.tourCode).toBe('CTP221261106TW01')
    expect(r.warnings.some((w) => w.includes('기간 섞임 경고'))).toBe(true)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('가격을 만들지 않음: 남은 행 가격은 모두 응답 adultPrice 그대로', async () => {
    const r = await collectKyowontourCalendarRange('CTP221', {
      ...OPTS,
      expectedTripDuration: { nights: 2, days: 3 },
    })
    for (const row of r.rows) {
      expect(row.adultPriceFromCalendar).toBe((row.rawJson as DayAir).adultPrice)
    }
  })
})
