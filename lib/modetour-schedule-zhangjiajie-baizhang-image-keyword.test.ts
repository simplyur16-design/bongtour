/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 백장협≠Bailong · Tianmen cable car 금지 — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'

describe('modetour Zhangjiajie Baizhang / Tianmen imageKeyword', () => {
  it('maps 백장협 to Baizhang Gorge not Bailong Elevator', () => {
    expect(firstMatchingScheduleSpotEn('백장협')).toMatch(/^Baizhang Gorge$/i)
    expect(firstMatchingScheduleSpotEn('백장협')).not.toMatch(/Bailong/i)
    expect(firstMatchingScheduleSpotEn('백룡 엘리베이터')).toMatch(/^Bailong Elevator$/i)
    expect(firstMatchingScheduleSpotEn('천문산')).toMatch(/^Tianmen Mountain$/i)
    expect(firstMatchingScheduleSpotEn('천문산')).not.toMatch(/cable/i)
    expect(firstMatchingScheduleSpotEn('칠성산')).toMatch(/Seven Star/i)
  })

  it('CJE501-like Day4 route — Baofeng + Baizhang not Bailong mis-map', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 2,
          title: '장가계 - 천문산 - 칠성산',
          routeText: '장가계 - 천문산 - 칠성산',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '장가계 - 백장협(차창관광) - 보봉호',
          routeText: '장가계 - 백장협(차창관광) - 보봉호',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        brandKey: 'modetour',
        productDestination: '장가계',
        productTitle: '장사 장가계/원가계 3박5일',
      },
    )

    const d2 = out[0]!
    expect(d2.imageKeyword).toMatch(/Zhangjiajie|Tianmen|Seven Star/i)
    expect(String(d2.imageKeyword2 ?? '')).not.toMatch(/cable/i)

    const d4 = out[1]!
    expect(String(d4.imageKeyword)).not.toMatch(/Bailong/i)
    expect(
      `${d4.imageKeyword ?? ''} ${d4.imageKeyword2 ?? ''}`,
    ).toMatch(/Baizhang|Baofeng|Zhangjiajie/i)
  })
})
