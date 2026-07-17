/**
 * REGRESSION-FREEZE[kyowontour-sweep-e2e-recheck]: departDateYmd 파싱
 * REGRESSION-FREEZE[kyowontour-admin-rescrape-master-code]: tourCode→6자 masterCode
 */
import { describe, expect, it } from 'vitest'
import {
  extractKyowontourMonthEvtDepartYmds,
  parseKyowontourCalendarDayAirRow,
} from './kyowontour-departures'
import { resolveKyowontourSweepCollectKeys } from './kyowontour-price-collect'

describe('resolveKyowontourSweepCollectKeys masterCode', () => {
  it('full tourCode originCode → 6자 masterCode (EWP300)', () => {
    const keys = resolveKyowontourSweepCollectKeys({
      originCode: 'EWP300260712TW01',
      originUrl:
        'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=EWP300260712TW01&menuCode=M51010106&brandId=0',
    })
    expect(keys?.masterCode).toBe('EWP300')
    expect(keys?.tourCodeHint).toBe('EWP300260712TW01')
  })

  it('already-master originCode stays 6자', () => {
    const keys = resolveKyowontourSweepCollectKeys({
      originCode: 'EWP300',
      originUrl:
        'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=EWP300260712TW01&menuCode=M51010106',
    })
    expect(keys?.masterCode).toBe('EWP300')
    expect(keys?.tourCodeHint).toBe('EWP300260712TW01')
  })
})

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
