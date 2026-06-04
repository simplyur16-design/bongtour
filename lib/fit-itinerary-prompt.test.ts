import { describe, expect, it } from 'vitest'
import { buildAirtelPrompt } from '@/lib/fit-itinerary-generate-for-product'

describe('buildAirtelPrompt', () => {
  it('요청 day·상품 summary 를 2문장 브리프로 명시한다', () => {
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
    expect(prompt).toContain('summary(정확히 2문장 한국어)')
    expect(prompt).toContain('반드시 정확히 2문장')
    expect(prompt).toContain('한 문장만 출력 금지')
    expect(prompt).toContain('구체 지명·랜드마크 한글 고유명사')
    expect(prompt).toContain('합계 50~90자')
    expect(prompt).not.toContain('summary(1문장 한국어)')
  })
})
