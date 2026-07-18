/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: kw2 must not semantic-overlap primary — manifest
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 북경 도시허브=Beijing (자금성 POI는 SPOT) — manifest
 */
import { describe, expect, it } from 'vitest'
import { scheduleImageKeywordsSemanticallyOverlap } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { firstMatchingScheduleCityEn, firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'

const SUPPLIERS = [
  'modetour',
  'hanatour',
  'ybtour',
  'lottetour',
  'kyowontour',
  'verygoodtour',
] as const

const beijingRows = [
  {
    day: 1,
    title: '북경 · 천안문광장',
    description: '역사 유적',
    routeText: '북경 - VIP 리무진 버스 - 전문대가 - 천안문광장',
    imageKeyword: '',
    imageKeyword2: null as string | null,
  },
  {
    day: 2,
    title: '팔달령만리장성',
    description: '만리장성',
    routeText: '팔달령만리장성 - 명13릉 - 이화원',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '자금성',
    description: '자금성',
    routeText: '자금성 - 스차하이 - 인력거 - 경산공원 - 더플레이스',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    title: '귀국',
    description: '귀국',
    routeText: '도시락 식사 후',
    imageKeyword: '',
    imageKeyword2: null,
  },
]

describe('cross-supplier schedule imageKeyword SSOT', () => {
  it('semantic overlap: Jingshan long/short yes; Manzhouli≠Matryoshka; Beijing≠Forbidden City', () => {
    expect(
      scheduleImageKeywordsSemanticallyOverlap(
        'Jingshan Park',
        'Jingshan Park Beijing Forbidden City view',
      ),
    ).toBe(true)
    expect(scheduleImageKeywordsSemanticallyOverlap('Manzhouli', 'Matryoshka Square Manzhouli')).toBe(
      false,
    )
    expect(scheduleImageKeywordsSemanticallyOverlap('Beijing', 'Forbidden City Beijing')).toBe(false)
    expect(firstMatchingScheduleCityEn('북경')).toBe('Beijing')
    expect(firstMatchingScheduleSpotEn('자금성')).toMatch(/Forbidden City/i)
  })

  for (const supplier of SUPPLIERS) {
    it(`${supplier}: Beijing-like trip — no same-day semantic kw1=kw2; D1 not Forbidden from hub`, () => {
      const out = applyRegisterScheduleImageKeywordsBySupplier(beijingRows, {
        supplierKey: supplier,
        productDestination: '북경',
        productTitle: '북경 4일',
        travelScope: 'package',
      })
      const d1 = out[0]!
      const d3 = out[2]!
      // 도시허브만으로 자금성 선점 금지 (빈 칸·천안문·서커스 등 허용)
      if (String(d1.imageKeyword ?? '').trim()) {
        expect(String(d1.imageKeyword)).not.toMatch(/^Forbidden City$/i)
      }
      expect(
        scheduleImageKeywordsSemanticallyOverlap(
          String(d1.imageKeyword ?? ''),
          String(d1.imageKeyword2 ?? ''),
        ),
      ).toBe(false)
      if (String(d3.imageKeyword ?? '').trim() && String(d3.imageKeyword2 ?? '').trim()) {
        expect(
          scheduleImageKeywordsSemanticallyOverlap(
            String(d3.imageKeyword),
            String(d3.imageKeyword2),
          ),
        ).toBe(false)
      }
    })
  }
})
