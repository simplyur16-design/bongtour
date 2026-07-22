/**
 * REGRESSION-FREEZE[lottetour-calendar-month-concurrency]: parallel month prefetch — manifest
 */
import { describe, expect, it } from 'vitest'
import { collectLottetourCalendarRange } from '@/lib/lottetour-departures'

function evtListHtml(evtCd: string, priceLabel: string): string {
  return `<table><tbody><tr><td><input type="checkbox"/></td><td><a href="/evtDetail/826/858/3604/5603?evtCd=${evtCd}">07/15</a> (수) 10:20</td><td>KE</td><td></td><td>title</td><td>3박4일</td><td><strong class="price">${priceLabel}</strong></td><td>출발확정 예약 14명 / 총 14석 남은좌석 0석</td></tr></tbody></table>`
}

describe('lottetour calendar month concurrency', () => {
  it('prefetch htmlByDepYm collects months in parallel without network', async () => {
    const htmlByDepYm = new Map<string, string>([
      ['202607', evtListHtml('A01B260715KE001', '1,199,000원')],
      ['202608', evtListHtml('A01B260810KE001', '1,299,000원')],
      ['202609', evtListHtml('A01B260905KE001', '1,399,000원')],
    ])
    const { rows } = await collectLottetourCalendarRange(
      { godId: 'GODTEST', menuNos: ['1', '2', '3', '4'] },
      {
        monthCount: 3,
        dateFrom: '2026-07',
        htmlByDepYm,
        monthConcurrency: 3,
        disableE2EFallback: true,
      },
    )
    expect(rows.length).toBe(3)
    expect(rows.map((r) => r.departDate)).toEqual(['2026-07-15', '2026-08-10', '2026-09-05'])
    expect(rows.map((r) => r.adultPrice)).toEqual([1_199_000, 1_299_000, 1_399_000])
  })
})
