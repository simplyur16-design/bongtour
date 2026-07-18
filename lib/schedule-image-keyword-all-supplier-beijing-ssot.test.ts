/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: kw2 must not semantic-overlap primary — manifest
 * 전 공급사 — 동일 POI 장·단문 overlap + 북경 hub≠명소 선점
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { scheduleImageKeywordsSemanticallyOverlap } from '@/lib/register-schedule-llm-image-keyword-fallback'

const BEIJING_ROWS = [
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
    title: '만리장성',
    description: '역사 유적',
    routeText: '팔달령만리장성 - 명13릉 - 이화원',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '자금성',
    description: '역사 유적',
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

const SUPPLIERS = [
  'kyowontour',
  'lottetour',
  'modetour',
  'hanatour',
  'ybtour',
  'verygoodtour',
] as const

describe('all-supplier schedule imageKeyword semantic + Beijing spot-first', () => {
  it('semantic overlap is prefix-based (not bare includes)', () => {
    expect(
      scheduleImageKeywordsSemanticallyOverlap(
        'Jingshan Park',
        'Jingshan Park Beijing Forbidden City view',
      ),
    ).toBe(true)
    expect(scheduleImageKeywordsSemanticallyOverlap('Manzhouli', 'Matryoshka Square Manzhouli')).toBe(
      false,
    )
  })

  for (const supplier of SUPPLIERS) {
    it(`${supplier}: Day1 Tiananmen not Forbidden-from-hub; Day3 Forbidden≠Jingshan long-dup`, () => {
      const out = applyRegisterScheduleImageKeywordsBySupplier(
        BEIJING_ROWS.map((r) => ({ ...r })),
        {
          supplierKey: supplier,
          productDestination: '북경',
          productTitle: '북경 4일',
          travelScope: 'package',
        },
      )
      const d1 = out[0]!
      const d3 = out[2]!
      expect(String(d1.imageKeyword ?? '')).toMatch(/Tiananmen|Great Wall|Forbidden|Summer|Shichahai|Jingshan|The Place|Beijing Circus|Ming/i)
      // 도시허브만으로 자금성 확정 금지(천안문 등 명소가 route에 있을 때)
      if (/천안문|Tiananmen/i.test(String(d1.routeText))) {
        expect(String(d1.imageKeyword ?? '')).not.toBe('Forbidden City')
      }
      if (String(d3.imageKeyword2 ?? '').trim()) {
        expect(
          scheduleImageKeywordsSemanticallyOverlap(
            String(d3.imageKeyword ?? ''),
            String(d3.imageKeyword2 ?? ''),
          ),
        ).toBe(false)
      }
    })
  }
})
