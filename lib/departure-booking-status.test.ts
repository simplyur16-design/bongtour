import { describe, expect, it } from 'vitest'
import {
  filterDeparturesOnSaleForImport,
  isAdultPriceAbsentMarker,
  isDepartureOnSaleForImport,
  normalizeDepartureBookingStatus,
} from '@/lib/departure-booking-status'

describe('normalizeDepartureBookingStatus', () => {
  it('maps common supplier labels', () => {
    expect(normalizeDepartureBookingStatus('예약가능')).toBe('예약가능')
    expect(normalizeDepartureBookingStatus('대기 예약')).toBe('대기예약')
    expect(normalizeDepartureBookingStatus('예약마감')).toBe('마감')
    expect(normalizeDepartureBookingStatus('출발확정')).toBe('출발확정')
  })

  it('returns null for empty/unknown (no silent 예약가능 invent)', () => {
    expect(normalizeDepartureBookingStatus(null)).toBeNull()
    expect(normalizeDepartureBookingStatus('')).toBeNull()
    expect(normalizeDepartureBookingStatus('확인중')).toBeNull()
  })
})

describe('isAdultPriceAbsentMarker', () => {
  it('treats dash/empty as no departure that day', () => {
    expect(isAdultPriceAbsentMarker('-')).toBe(true)
    expect(isAdultPriceAbsentMarker('—')).toBe(true)
    expect(isAdultPriceAbsentMarker('')).toBe(true)
    expect(isAdultPriceAbsentMarker('1,290,000')).toBe(false)
    expect(isAdultPriceAbsentMarker(1290000)).toBe(false)
  })
})

describe('isDepartureOnSaleForImport', () => {
  it('keeps 대기예약 as 대기예약 (not dropped, not converted to 예약가능); excludes 마감 only', () => {
    expect(normalizeDepartureBookingStatus('대기예약')).toBe('대기예약')
    expect(normalizeDepartureBookingStatus('대기예약')).not.toBe('예약가능')
    expect(isDepartureOnSaleForImport('대기예약')).toBe(true)
    expect(isDepartureOnSaleForImport('예약가능')).toBe(true)
    expect(isDepartureOnSaleForImport('출발확정')).toBe(true)
    expect(isDepartureOnSaleForImport(null)).toBe(true)
    expect(normalizeDepartureBookingStatus('마감')).toBe('마감')
    expect(isDepartureOnSaleForImport('예약마감')).toBe(false)
    expect(isDepartureOnSaleForImport('마감')).toBe(false)
  })
})

describe('filterDeparturesOnSaleForImport (supplier upsert/collect SSOT)', () => {
  const suppliers = [
    'hanatour',
    'modetour',
    'ybtour',
    'kyowontour',
    'lottetour',
    'naeiltour',
    'verygoodtour',
  ] as const

  it.each(suppliers)('%s path: drops 마감, keeps 대기예약/예약가능/출발확정', (supplier) => {
    const rows = [
      { supplier, departureDate: '2026-07-01', statusRaw: '마감', adultPrice: 100_000 },
      { supplier, departureDate: '2026-07-02', statusRaw: '예약마감', adultPrice: 100_000 },
      { supplier, departureDate: '2026-07-03', statusRaw: '대기예약', adultPrice: 100_000 },
      { supplier, departureDate: '2026-07-04', statusRaw: '예약가능', adultPrice: 100_000 },
      { supplier, departureDate: '2026-07-05', statusRaw: '출발확정', adultPrice: 100_000 },
      { supplier, departureDate: '2026-07-06', status: '마감', adultPrice: 100_000 },
    ]
    const kept = filterDeparturesOnSaleForImport(rows)
    expect(kept.map((r) => r.departureDate)).toEqual([
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
    ])
  })
})
