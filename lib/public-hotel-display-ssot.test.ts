import { describe, expect, it } from 'vitest'
import {
  scrubPublicHotelDisplayLine,
  scrubPublicHotelNameList,
} from '@/lib/public-hotel-display-ssot'

// REGRESSION-FREEZE[public-hotel-display-scrub]: 공개 호텔 scrub — manifest
describe('scrubPublicHotelDisplayLine', () => {
  it('부산 예정 호텔 placeholder → null', () => {
    expect(scrubPublicHotelDisplayLine('부산 예정 호텔(동급 가능)')).toBeNull()
    expect(scrubPublicHotelDisplayLine('대구 예정 호텔')).toBeNull()
  })

  it('슬래시 나열 + 호텔소개 → 대표 숙소명', () => {
    const r = scrubPublicHotelDisplayLine(
      'HOTEL VISTA Matsuyama / 객실사진 / Hiyori Hotel Matsuyama / 히요리 호텔 마츠야마 / 호텔소개',
    )
    expect(r).toMatch(/VISTA|Matsuyama|히요리|마츠야마/i)
    expect(r).not.toMatch(/호텔소개|객실사진|정보\s*보기/)
  })

  it('정보보기·호텔소개 alone → null', () => {
    expect(scrubPublicHotelDisplayLine('호텔소개')).toBeNull()
    expect(scrubPublicHotelDisplayLine('정보보기')).toBeNull()
  })
})

describe('scrubPublicHotelNameList', () => {
  it('중복·크롬 제거 후 최대 3', () => {
    const r = scrubPublicHotelNameList([
      '부산 예정 호텔(동급 가능)',
      'HOTEL VISTA Matsuyama',
      '호텔소개',
      'HOTEL VISTA Matsuyama',
      'Hiyori Hotel Matsuyama',
    ])
    expect(r.length).toBeGreaterThanOrEqual(1)
    expect(r.length).toBeLessThanOrEqual(3)
    expect(r.join(' ')).not.toMatch(/부산|호텔소개/)
  })
})
