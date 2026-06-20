/**
 * REGRESSION-FREEZE[modetour-register-detail-collect]
 */
import { describe, expect, it } from 'vitest'
import {
  extractModetourIncludedExcludedFromDetailInfo,
  extractModetourMustKnowFromKeyPointInfo,
  modetourHtmlNoteToPlainText,
} from './modetour-register-api-detail'
import {
  modetourFactDaysToRegisterSchedule,
  needsModetourIncludedExcludedCollect,
  needsModetourScheduleCollect,
} from './modetour-register-detail-collect'
import type { RegisterParsed } from './register-llm-schema-modetour'

describe('modetour register detail collect', () => {
  it('needs schedule collect when empty', () => {
    expect(needsModetourScheduleCollect({ schedule: [] } as RegisterParsed)).toBe(true)
    expect(
      needsModetourScheduleCollect({
        schedule: [{ day: 1, title: '오사카', description: '관광', imageKeyword: 'Osaka' }],
      } as RegisterParsed),
    ).toBe(false)
  })

  it('needs included/excluded when both missing', () => {
    expect(needsModetourIncludedExcludedCollect({} as RegisterParsed)).toBe(true)
    expect(
      needsModetourIncludedExcludedCollect({
        includedText: '항공권',
        excludedText: '팁',
      } as RegisterParsed),
    ).toBe(false)
  })

  it('maps B2C fact days to RegisterScheduleDay', () => {
    const days = modetourFactDaysToRegisterSchedule([
      {
        day: 1,
        places: ['인천', '구마모토'],
        hotels: ['구마모토 호텔'],
        meals: ['기내식', '석식 현지식'],
        transportNote: '국제선 탑승',
      },
    ])
    expect(days).toHaveLength(1)
    expect(days[0]?.title).toBe('인천')
    expect(days[0]?.routeText).toBe('인천 - 구마모토')
    expect(days[0]?.hotelText).toContain('구마모토')
    expect(days[0]?.dinnerText).toContain('석식')
  })

  it('parses GetProductDetailInfo includedNote/unincludedNote HTML', () => {
    const detail = {
      includedNote:
        '<p><span>- 왕복항공권</span><br /><span>- 숙박비(2인1실)</span><br /><span>- 여행자보험</span></p>',
      unincludedNote: '<p><span>- 개인경비</span><br /><span>- 가이드/기사 경비 USD 40</span></p>',
    }
    const parsed = extractModetourIncludedExcludedFromDetailInfo(detail)
    expect(parsed.includedItems).toContain('왕복항공권')
    expect(parsed.includedItems).toContain('숙박비(2인1실)')
    expect(parsed.excludedItems.some((x) => /가이드/.test(x))).toBe(true)
    expect(modetourHtmlNoteToPlainText(detail.includedNote)).toContain('왕복항공권')
  })

  it('parses GetProductKeyPointInfo specialBenefits into must-know rows', () => {
    const rows = extractModetourMustKnowFromKeyPointInfo({
      specialBenefits: ['F1 연습주행 3회', '고카트 체험'],
      travelerInsuranceInfo: '가입(최대 3억원 보장)',
      productScore: '상품 핵심 포인트',
    })
    expect(rows.some((r) => r.body.includes('F1'))).toBe(true)
    expect(rows.some((r) => r.title.includes('보험'))).toBe(true)
    expect(rows.some((r) => r.body === '상품 핵심 포인트')).toBe(false)
  })
})
