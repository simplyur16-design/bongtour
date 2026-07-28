/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: CAP104 Qingdao 소어산≠Zhanqiao — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { firstMatchingScheduleCityEn, firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'

describe('CAP104 Qingdao schedule image keywords', () => {
  it('maps 소어산·대복도·일출; city hub is bare Qingdao not Zhanqiao', () => {
    expect(firstMatchingScheduleCityEn('칭다오')).toBe('Qingdao')
    expect(firstMatchingScheduleCityEn('칭다오')).not.toMatch(/Zhanqiao/i)
    expect(firstMatchingScheduleSpotEn('잔교')).toMatch(/Zhanqiao/i)
    expect(firstMatchingScheduleSpotEn('소어산')).toMatch(/Signal Hill/i)
    expect(firstMatchingScheduleSpotEn('대복도')).toMatch(/Dabaodao/i)
    expect(firstMatchingScheduleSpotEn('칭다오 바다 일출')).toMatch(/sunrise|Qingdao/i)
  })

  it('apply — D2 Signal Hill not Zhanqiao; D1 Dabaodao kw2; D3 sunrise', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          title: '',
          description: '',
          routeText: '칭다오 맥주 박물관 - 맥주박물관1 - 가장 맛있는 칭다오맥주 체험! - 대복도',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '',
          description: '',
          routeText: '지모루 시장 - 찌모루 시장 - 칭다오의 전통 로컬시장 - 소어산',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '',
          description: '',
          routeText: '칭다오의 일출 - 칭다오 바다 일출',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'hanatour',
        productDestination: '칭다오',
        productTitle: '칭다오 3일 #맥주박물관 #바다일출',
        travelScope: 'package',
      },
    )
    const by = (d: number) => out.find((r) => r.day === d)!
    expect(String(by(1).imageKeyword ?? '')).toMatch(/Tsingtao|Beer Museum/i)
    expect(String(by(1).imageKeyword2 ?? '')).toMatch(/Dabaodao|Small Qingdao/i)
    expect(String(by(2).imageKeyword ?? '')).toMatch(/Jimo/i)
    expect(String(by(2).imageKeyword2 ?? '')).toMatch(/Signal Hill/i)
    expect(`${by(2).imageKeyword ?? ''} ${by(2).imageKeyword2 ?? ''}`).not.toMatch(/Zhanqiao/i)
    expect(String(by(3).imageKeyword ?? '')).toMatch(/sunrise|Qingdao/i)
    expect(String(by(3).imageKeyword ?? '')).not.toMatch(/Zhanqiao/i)
  })
})
