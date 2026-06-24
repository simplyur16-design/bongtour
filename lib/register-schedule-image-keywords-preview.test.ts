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

  it('하나투어 자유여행은 패키지 imageKeyword 규칙(타지마할 등)을 적용하지 않는다', () => {
    const llm = [
      {
        day: 2,
        title: '아그라',
        description: '타지마할 외부 관람',
        routeText: '델리 - 아그라',
        imageKeyword: 'Agra',
        imageKeyword2: null,
      },
    ]
    const preview = applyRegisterScheduleImageKeywordsForPreview(llm, {
      supplierKey: 'hanatour',
      productDestination: 'India',
      travelScope: 'air_hotel_free',
      productType: 'air-hotel',
    })
    expect(preview[0]!.imageKeyword).not.toBe('Taj Mahal')
    expect(preview[0]!.imageKeyword).not.toBe('Agra Fort')
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

  it('칭다오 한글 routeText — modetour·hanatour 미리보기 자동 추천', () => {
    const rows = [
      {
        day: 1,
        title: '출입국',
        description: '출입국 정보',
        routeText: '천주교당(성미카엘성당) - 잔교',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '칭다오',
        description: '관광',
        routeText: '지모루 시장 - 청도 54광장',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ]
    for (const supplierKey of ['modetour', 'hanatour'] as const) {
      const preview = applyRegisterScheduleImageKeywordsForPreview(rows, {
        supplierKey,
        productDestination: '칭다오',
      })
      expect(preview[0]!.imageKeyword).toMatch(/Michael|Zhanqiao/i)
      expect(preview[1]!.imageKeyword).toMatch(/Jimo|May Fourth/i)
    }
  })
})
