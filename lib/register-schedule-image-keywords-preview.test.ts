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
})
