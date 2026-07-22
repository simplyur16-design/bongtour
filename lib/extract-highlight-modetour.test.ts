/**
 * REGRESSION-FREEZE[modetour-register-highlight-keypoint]: keyPoint → highlight — manifest
 */
import { describe, expect, it } from 'vitest'
import {
  extractHighlightFromModetour,
  formatModetourHighlightPointsFromKeyPointInfo,
} from '@/lib/extract-highlight-modetour'

describe('extract-highlight-modetour', () => {
  it('extracts 상품 POINT block', () => {
    const out = extractHighlightFromModetour(`
상품 POINT
• F1 연습주행 3회
• 고카트 체험
MODE'S EVENT
이벤트 본문
`)
    expect(out).toMatch(/F1/)
    expect(out).toMatch(/고카트/)
    expect(out).not.toMatch(/EVENT/)
  })

  it('formatModetourHighlightPointsFromKeyPointInfo keeps benefits/sights/hotels, drops insurance', () => {
    const out = formatModetourHighlightPointsFromKeyPointInfo({
      specialBenefits: ['F1 연습주행 3회', '고카트 체험'],
      sightseeings: ['다낭 시내 관광'],
      hotels: ['다낭 4성 호텔'],
      travelerInsuranceInfo: '가입(최대 3억원 보장)',
      businessGuarantee: '공제 가입',
      meals: ['조식 포함'],
    })
    expect(out).toMatch(/F1/)
    expect(out).toMatch(/다낭 시내/)
    expect(out).toMatch(/4성 호텔/)
    expect(out).not.toMatch(/보험|공제|조식/)
  })
})
