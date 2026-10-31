import { describe, expect, it } from 'vitest'
import { buildAirtelPrompt } from '@/lib/fit-itinerary-generate-for-product'

describe('buildAirtelPrompt', () => {
  it('톤 1031: 일차 summary 3~4문장 실장 말투·금지어·숙소 규칙·숫자 필드 null', () => {
    const prompt = buildAirtelPrompt({
      title: '오사카 3박4일',
      cityNameKo: '오사카',
      cityKey: 'osaka',
      countryCode: 'JP',
      duration: '3박 4일',
      totalDays: 4,
      airline: 'OZ',
      hotelSummaryText: '난바 호텔',
      airtelHotelInfoJson: null,
      schedule: null,
    })
    expect(prompt).toContain('봉투어 실장')
    expect(prompt).toContain('일차 summary: 3~4문장')
    expect(prompt).toContain('숫자를 쓰지 않습니다')
    expect(prompt).toContain('숙소 근처')
    expect(prompt).toContain('하루 한 권역')
    expect(prompt).toContain('"startTime": null')
    expect(prompt).not.toContain('정확히 2문장 한국어')
    expect(prompt).not.toContain('summary(1문장 한국어)')
  })

  it('동선은 예시 일정 activities, imageKeyword는 attraction 랜드마크만', () => {
    const prompt = buildAirtelPrompt({
      title: '파리 3박4일',
      cityNameKo: '파리',
      cityKey: 'paris',
      countryCode: 'FR',
      duration: '3박 4일',
      totalDays: 4,
      airline: null,
      hotelSummaryText: null,
      airtelHotelInfoJson: null,
      schedule: null,
    })
    expect(prompt).toContain('activities가 그날 **동선**')
    expect(prompt).toContain('attraction location의 괄호 영문 랜드마크')
    expect(prompt).toContain('식사·쇼핑 상호명')
    expect(prompt).not.toContain('attraction·shopping·meal location')
  })
})
