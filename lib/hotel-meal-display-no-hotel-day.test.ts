/**
 * no-hotel-day-display-1031 — 무숙박(기내박 등) 일차·귀국 도착일에 상품 대표 호텔 폴백 금지.
 */
import { describe, expect, it } from 'vitest'
import {
  formatScheduleDayHotelLine,
  isExplicitNoHotelDayText,
  isLikelyReturnArrivalDayWithoutHotel,
} from '@/lib/hotel-meal-display'

const SUMMARY = '월드체인 특급 호텔(MOVENPICK 등), 5성급 나일 크루즈 3박 및 후르가다 특급 리조트 이용.'

describe('A: 일차 숙소가 무숙박 명시', () => {
  it.each(['기내박', '기내박()', ': 기내박', '기내숙박', '숙박 없음', '숙박 없음(귀국)', '숙박없음'])(
    '%s → 호텔 줄 없음',
    (dayHotelText) => {
      expect(isExplicitNoHotelDayText(dayHotelText)).toBe(true)
      expect(formatScheduleDayHotelLine({ hotelSummaryText: SUMMARY, hotelNames: ['Caesar Metro Taipei'], dayHotelText })).toBeNull()
    },
  )
  it('차중박: 일차 문구가 공개 scrub 통과 시 그 문구 그대로 (상품 호텔 폴백 아님)', () => {
    expect(isExplicitNoHotelDayText('차중박')).toBe(true)
    expect(formatScheduleDayHotelLine({ hotelSummaryText: SUMMARY, dayHotelText: '차중박' })).not.toBe(SUMMARY)
  })
  it('yb-0034 D8 기내박 (마지막 일차 아님) → null', () => {
    expect(formatScheduleDayHotelLine({ hotelSummaryText: SUMMARY, dayHotelText: '기내박', isLastScheduleRow: false })).toBeNull()
  })
  it('실제 호텔 일차는 그대로', () => {
    expect(
      formatScheduleDayHotelLine({ hotelSummaryText: SUMMARY, dayHotelText: 'MOVENPICK SOMABAY 또는 동급' }),
    ).toContain('MOVENPICK SOMABAY')
  })
  it('무숙박 단어가 섞인 문장은 A 대상 아님 (호텔명 포함)', () => {
    expect(isExplicitNoHotelDayText('기내박 후 힐튼 호텔 투숙')).toBe(false)
    expect(isExplicitNoHotelDayText('예정 호텔(출발 전 확정)')).toBe(false)
  })
  it('예정 호텔(미정) 문구는 기존대로 상품 호텔 폴백', () => {
    expect(formatScheduleDayHotelLine({ hotelSummaryText: SUMMARY, dayHotelText: '예정 호텔(출발 전 확정)' })).toBe(SUMMARY)
  })
  it('일차 숙소 null + 마지막 일차 아님 → 기존대로 폴백', () => {
    expect(formatScheduleDayHotelLine({ hotelSummaryText: SUMMARY, dayHotelText: null })).toBe(SUMMARY)
  })
})

describe('B: 마지막 일차 귀국 도착 인식 확대', () => {
  const D9 = '[00:20] 이스탄불 도착 (약 2시간 35분 소요)\n[02:20] 이스탄불 출발 (TK090편)\n[18:20] 인천 도착 (약 9시간 55분 소요)'
  it('yb-0034 D9 `인천 도착` → 귀국일', () => {
    expect(isLikelyReturnArrivalDayWithoutHotel(D9)).toBe(true)
    expect(formatScheduleDayHotelLine({ hotelSummaryText: SUMMARY, dayHotelText: null, isLastScheduleRow: true, dayDescription: D9 })).toBeNull()
  })
  it.each(['김해 도착', '김포공항 도착', '부산 도착', '인천국제공항 도착', '귀국 후 도착'])('%s → true', (t) => {
    expect(isLikelyReturnArrivalDayWithoutHotel(`[10:00] 출발\n[15:00] ${t}`)).toBe(true)
  })
  it('호텔 투숙·숙박 문구가 있으면 false (기존)', () => {
    expect(isLikelyReturnArrivalDayWithoutHotel('인천 도착 후 호텔 투숙')).toBe(false)
  })
  it('D1 인천 출발 → 현지 도착은 false (기존)', () => {
    expect(isLikelyReturnArrivalDayWithoutHotel('인천 출발 (TK091편)\n이스탄불 도착')).toBe(false)
  })
  it('마지막 일차가 아니면 B 미적용', () => {
    expect(formatScheduleDayHotelLine({ hotelSummaryText: SUMMARY, dayHotelText: null, isLastScheduleRow: false, dayDescription: D9 })).toBe(SUMMARY)
  })
})
