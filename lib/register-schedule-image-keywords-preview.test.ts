import { describe, expect, it } from 'vitest'
import {
  applyRegisterScheduleImageKeywordsForPreview,
  overlayPreviewScheduleImageKeywords,
} from '@/lib/register-schedule-image-keywords-preview'

describe('overlayPreviewScheduleImageKeywords', () => {
  it('confirm용 schedule에 미리보기 SSOT 키워드를 복사한다', () => {
    const llm = [
      {
        day: 2,
        title: '아그라',
        description: '타지마할 외부 관람과 아그라 성 방문',
        routeText: '델리 - 아그라',
        imageKeyword: 'Agra',
        imageKeyword2: null,
      },
    ]
    const preview = applyRegisterScheduleImageKeywordsForPreview(llm, {
      supplierKey: 'hanatour',
      productDestination: 'India',
    })
    const out = overlayPreviewScheduleImageKeywords(llm, preview)
    expect(out[0]!.imageKeyword).toBe('Taj Mahal')
    expect(out[0]!.imageKeyword2).toBe('Agra Fort')
  })

  it('하나투어 자유여행(airtel) 미리보기도 스파·식당 LLM 키워드를 랜드마크로 교정', () => {
    const llm = [
      {
        day: 3,
        title: '푸꾸옥 관광',
        description: '스타피쉬 비치와 호국사',
        routeText: '스타피쉬 비치 - 호국사 - 사오 비치',
        imageKeyword: 'Moon Spa',
        imageKeyword2: null,
      },
    ]
    const preview = applyRegisterScheduleImageKeywordsForPreview(llm, {
      supplierKey: 'hanatour',
      productDestination: '베트남',
      travelScope: 'air_hotel_free',
      productType: 'air-hotel',
    })
    expect(preview[0]!.imageKeyword).not.toMatch(/spa|restaurant|lounge/i)
    expect(preview[0]!.imageKeyword).toMatch(/Ho Quoc|Starfish|Sao Beach/i)
  })
})
