import { describe, expect, it } from 'vitest'
import {
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
  it('excludes 마감 only', () => {
    expect(isDepartureOnSaleForImport('예약가능')).toBe(true)
    expect(isDepartureOnSaleForImport('대기예약')).toBe(true)
    expect(isDepartureOnSaleForImport('출발확정')).toBe(true)
    expect(isDepartureOnSaleForImport(null)).toBe(true)
    expect(isDepartureOnSaleForImport('예약마감')).toBe(false)
    expect(isDepartureOnSaleForImport('마감')).toBe(false)
  })
})
