import { describe, expect, it } from 'vitest'
import {
  compareWeekStartYmd,
  formatCompareWeekLabel,
  formatCompareWeekPriceLabel,
  listCompareWeekOptions,
  parseCompareWeekParam,
  pickCompareWeekDeparture,
  resolveSelectedCompareWeek,
  toCompareWeekRows,
} from '@/lib/similar-itinerary-compare-week'

// 2026-11-01(일) 09:00 KST — 공개 예약가능 하한은 KST 오늘+2 = 11/3
const BASE = new Date('2026-11-01T00:00:00.000Z')

const dep = (id: string, ymd: string, adultPrice: number | null, extra: Record<string, unknown> = {}) => ({
  id,
  departureDate: new Date(`${ymd}T00:00:00.000Z`),
  adultPrice,
  ...extra,
})

describe('similar-itinerary-compare-week', () => {
  it('주 시작은 월요일', () => {
    expect(compareWeekStartYmd('2026-11-01')).toBe('2026-10-26') // 일 → 앞 월
    expect(compareWeekStartYmd('2026-11-02')).toBe('2026-11-02') // 월
    expect(compareWeekStartYmd('2026-11-08')).toBe('2026-11-02') // 일
    expect(parseCompareWeekParam('2026-11-12')).toBe('2026-11-09')
    expect(parseCompareWeekParam('11/12')).toBeNull()
    expect(formatCompareWeekLabel('2026-11-09')).toBe('11/9(월)~11/15(일)')
  })

  it('그 주 안에서 성인가가 낮은 출발 1건, 같은 값이면 빠른 날짜, DB 값 그대로', () => {
    const rows = toCompareWeekRows([
      dep('a', '2026-11-10', 559000),
      dep('b', '2026-11-12', 499000, { carrierName: '진에어' }),
      dep('c', '2026-11-14', 499000),
      dep('d', '2026-11-17', 399000), // 다음 주
    ])
    const pick = pickCompareWeekDeparture(rows, '2026-11-09', BASE)
    expect(pick).toEqual({ departureId: 'b', dateYmd: '2026-11-12', adultKrw: 499000, carrierName: '진에어' })
    expect(formatCompareWeekPriceLabel(pick?.adultKrw)).toBe('499,000원')
  })

  it('하한 전·가격 없음·마감·잔여 0 은 빼고 추정하지 않음', () => {
    const rows = toCompareWeekRows([
      dep('past', '2026-11-02', 100000), // 하한(11/3) 전
      dep('none', '2026-11-04', null),
      dep('closed', '2026-11-05', 200000, { statusRaw: '마감' }),
      dep('soldout', '2026-11-06', 210000, { seatCount: 0, seatsStatusRaw: '잔여 0석' }),
    ])
    expect(pickCompareWeekDeparture(rows, '2026-11-02', BASE)).toBeNull()
    expect(formatCompareWeekPriceLabel(null)).toBe('이 주 출발 없음')
  })

  it('주간 목록은 이른 주부터, 기본은 가까운 주, 목록 밖 요청은 가까운 주', () => {
    const products = [
      { id: 'p1', supplierKey: 'hanatour', rows: toCompareWeekRows([dep('1', '2026-11-12', 500000), dep('2', '2026-11-20', 510000)]) },
      { id: 'p2', supplierKey: 'modetour', rows: toCompareWeekRows([dep('3', '2026-11-13', 520000)]) },
    ]
    const opts = listCompareWeekOptions(products, BASE)
    expect(opts.map((o) => [o.weekStartYmd, o.productCount, o.supplierCount])).toEqual([
      ['2026-11-09', 2, 2],
      ['2026-11-16', 1, 1],
    ])
    expect(resolveSelectedCompareWeek(null, opts)).toBe('2026-11-09')
    expect(resolveSelectedCompareWeek('2026-11-16', opts)).toBe('2026-11-16')
    expect(resolveSelectedCompareWeek('2026-12-07', opts)).toBe('2026-11-09')
    expect(resolveSelectedCompareWeek(null, [])).toBeNull()
  })
})
