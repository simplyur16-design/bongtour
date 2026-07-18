/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 백장협≠Bailong · Tianmen cable car 금지 — manifest
 */
import { describe, expect, it } from 'vitest'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'

describe('modetour Zhangjiajie CJE501 imageKeyword', () => {
  it('maps 백장협 to Baizhang Gorge not Bailong Elevator; Tianmen has no cable car', () => {
    expect(firstMatchingScheduleSpotEn('백장협')).toMatch(/^Baizhang Gorge$/i)
    expect(firstMatchingScheduleSpotEn('백장협')).not.toMatch(/Bailong/i)
    expect(firstMatchingScheduleSpotEn('백룡 엘리베이터')).toMatch(/^Bailong Elevator$/i)
    expect(firstMatchingScheduleSpotEn('천문산')).toMatch(/^Tianmen Mountain$/i)
    expect(firstMatchingScheduleSpotEn('천문산')).not.toMatch(/cable/i)
    expect(firstMatchingScheduleSpotEn('칠성산')).toMatch(/Seven Star/i)
  })

  it('CJE501-like 5-day — Day4 Baizhang≠Bailong; Day2 Tianmen short', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          title: '호남성',
          routeText: '호남성',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '장가계 - 천문산 - 칠성산',
          routeText: '장가계 - 천문산 - 칠성산',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '장가계 - 미혼대',
          routeText: '장가계 - 천자산 - 하룡공원 - 어필봉 - 원가계 - 천하제일교 - 미혼대',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '장가계 - 보봉호',
          routeText: '장가계 - 백장협(차창관광) - 보봉호',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 5,
          title: '귀국',
          routeText: '',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        brandKey: 'modetour',
        productDestination: '장가계',
        productTitle: '[비교불가] 장사 장가계/원가계 3박5일',
      },
    )

    const d2 = out.find((r) => r.day === 2)!
    expect(String(d2.imageKeyword2 ?? d2.imageKeyword)).not.toMatch(/cable/i)

    const d4 = out.find((r) => r.day === 4)!
    expect(String(d4.imageKeyword ?? '')).toMatch(/Baizhang Gorge|Baofeng Lake/i)
    expect(String(d4.imageKeyword ?? '')).not.toMatch(/Bailong/i)
    expect(String(d4.imageKeyword2 ?? '')).not.toMatch(/Bailong/i)
  })
})
