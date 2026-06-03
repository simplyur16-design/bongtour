import { describe, expect, it } from 'vitest'
import {
  airportTransferTypeForListingKind,
  resolveAirportTransferTypeForAirHotelFree,
} from '@/lib/airport-transfer-infer'

describe('resolveAirportTransferTypeForAirHotelFree', () => {
  it('returns NONE when excluded lists 공항↔호텔 이동', () => {
    expect(
      resolveAirportTransferTypeForAirHotelFree({
        excludedText: '공항↔호텔 이동\n조식 불포함',
      })
    ).toBe('NONE')
  })

  it('returns PICKUP when included mentions 공항 픽업', () => {
    expect(
      resolveAirportTransferTypeForAirHotelFree({
        includedText: '왕복항공권\n공항 픽업 포함',
      })
    ).toBe('PICKUP')
  })

  it('defaults to NONE when no transfer in included', () => {
    expect(
      resolveAirportTransferTypeForAirHotelFree({
        includedText: '왕복항공권\n호텔 3박',
        excludedText: '개인경비',
      })
    ).toBe('NONE')
  })

  it('trusts stored PICKUP/SENDING/BOTH over empty text', () => {
    expect(
      resolveAirportTransferTypeForAirHotelFree({
        airportTransferType: 'BOTH',
        includedText: null,
        excludedText: null,
      })
    ).toBe('BOTH')
  })

  it('prefers included 전용차량 over excluded 공항↔호텔 이동 line (ybtour-style)', () => {
    expect(
      resolveAirportTransferTypeForAirHotelFree({
        includedText: '· 교통 : 왕복항공권, 전용차량비용',
        excludedText: '공항↔호텔 이동\n개인경비',
        includedItems: ['· 교통 : 왕복항공권, 전용차량비용'],
        excludedItems: ['공항↔호텔 이동'],
      })
    ).toBe('BOTH')
  })

  it('detects 공항에서 호텔 픽업 in included', () => {
    expect(
      resolveAirportTransferTypeForAirHotelFree({
        includedText: '공항에서 호텔 픽업 서비스',
      })
    ).toBe('PICKUP')
  })
})

describe('airportTransferTypeForListingKind', () => {
  it('resolves only for air_hotel_free', () => {
    expect(
      airportTransferTypeForListingKind('travel', {
        airportTransferType: null,
        excludedText: '공항↔호텔 이동',
      })
    ).toBeNull()
    expect(
      airportTransferTypeForListingKind('air_hotel_free', {
        airportTransferType: null,
        excludedText: '공항↔호텔 이동',
      })
    ).toBe('NONE')
  })
})
