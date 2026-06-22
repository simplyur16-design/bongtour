/**
 * REGRESSION-FREEZE[hanatour-register-detail-collect]
 */
import { describe, expect, it } from 'vitest'
import {
  formatHanatourTrvlExpnBullet,
  hanatourFactDaysToRegisterSchedule,
  extractHanatourIncludedExcluded,
} from './hanatour-register-api-detail'
import {
  needsHanatourExcludedCollect,
  needsHanatourIncludedCollect,
  needsHanatourIncludedExcludedCollect,
  needsHanatourScheduleCollect,
} from './hanatour-register-detail-collect'
import type { RegisterParsed } from './register-llm-schema-hanatour'

describe('hanatour register detail collect', () => {
  it('needs schedule collect when empty or title-less', () => {
    expect(needsHanatourScheduleCollect({ schedule: [] } as RegisterParsed)).toBe(true)
    expect(
      needsHanatourScheduleCollect({
        schedule: [{ day: 1, title: '', description: '', imageKeyword: 'x' }],
      } as RegisterParsed),
    ).toBe(true)
    expect(
      needsHanatourScheduleCollect({
        schedule: [{ day: 1, title: '오사카', description: '관광', imageKeyword: 'Osaka' }],
      } as RegisterParsed),
    ).toBe(false)
  })

  it('needs included/excluded when both missing', () => {
    expect(needsHanatourIncludedExcludedCollect({} as RegisterParsed)).toBe(true)
    expect(
      needsHanatourIncludedExcludedCollect({
        includedText: '항공권',
        excludedText: '팁',
      } as RegisterParsed),
    ).toBe(false)
  })

  it('포함만 있어도 불포함 수집 필요', () => {
    expect(
      needsHanatourIncludedCollect({
        includedText: '항공권',
      } as RegisterParsed),
    ).toBe(false)
    expect(
      needsHanatourExcludedCollect({
        includedText: '항공권',
      } as RegisterParsed),
    ).toBe(true)
  })

  it('formats trvlExpnDesc with cluster prefix', () => {
    expect(
      formatHanatourTrvlExpnBullet({
        trvlExpnClstNm: '항공',
        trvlExpnDesc: '왕복 항공권',
        trvlExpnNm: 'legacy',
      }),
    ).toBe('항공 왕복 항공권')
  })

  it('maps fact days to RegisterScheduleDay', () => {
    const days = hanatourFactDaysToRegisterSchedule([
      {
        day: 1,
        places: ['인천', '오사카'],
        hotels: ['오사카 호텔'],
        meals: ['기내식', '석식 현지식'],
        transportNote: '국제선 탑승',
      },
    ])
    expect(days).toHaveLength(1)
    expect(days[0]?.title).toBe('인천')
    expect(days[0]?.routeText).toBe('인천 - 오사카')
    expect(days[0]?.hotelText).toContain('오사카')
    expect(days[0]?.dinnerText).toContain('석식')
  })

  it('merges fees into excluded items', () => {
    const { includedItems, excludedItems } = extractHanatourIncludedExcluded({
      trvlExpnInclList: [{ trvlExpnDesc: '왕복 항공권' }],
      trvlExpnNoneInclList: [{ trvlExpnDesc: '개인 경비' }],
      snglAddAmt: 500000,
      snglAddAmtDesc: '1인실 사용료 500,000원',
      guideExpnAmt: 20,
      guideExpnCurrCd: 'USD',
    })
    expect(includedItems).toContain('왕복 항공권')
    expect(excludedItems.some((x) => /개인 경비/.test(x))).toBe(true)
    expect(excludedItems.some((x) => /1인실|객실/i.test(x))).toBe(true)
    expect(excludedItems.some((x) => /가이드|기사/.test(x))).toBe(true)
  })
})
