/**
 * REGRESSION-FREEZE[kyowontour-sweep-e2e-recheck]: departDateYmd 파싱
 */
import { describe, expect, it } from 'vitest'
import {
  extractKyowontourMonthEvtDepartYmds,
  parseKyowontourCalendarDayAirRow,
} from './kyowontour-departures'

describe('extractKyowontourMonthEvtDepartYmds', () => {
  it('monthEvtList departDateYmd → YYYYMMDD', () => {
    const ymds = extractKyowontourMonthEvtDepartYmds({
      monthEvtList: [{ masterCode: 'MCP160', departDateYmd: '20260706' }, { departDateYmd: '20260713' }],
    })
    expect(ymds).toEqual(['20260706', '20260713'])
  })
})

describe('parseKyowontourCalendarDayAirRow', () => {
  it('departDateYmd(YYYYMMDD) → YYYY-MM-DD', () => {
    const row = parseKyowontourCalendarDayAirRow(
      {
        departDateYmd: '20260701',
        tourCode: 'CTP518260621TW02',
        adultPrice: 1299000,
        preferredAirlineNm: '티웨이항공',
        statusName: '예약가능',
      },
      'CTP518',
    )
    expect(row?.departDate).toBe('2026-07-01')
    expect(row?.adultPriceFromCalendar).toBe(1299000)
    expect(row?.airline).toBe('티웨이항공')
    expect(row?.status).toBe('available')
  })
})
