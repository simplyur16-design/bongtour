/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: kw2 must not semantic-overlap primary — manifest
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 북경 도시허브=Beijing (자금성 POI는 SPOT) — manifest
 * REGRESSION-FREEZE[register-schedule-route-place-noise]: 북경 교원 — VIP리무진·인력거·쇼·도시락 route 금지 — manifest
 * REGRESSION-FREEZE[kyowontour-schedule-expression]: 프랑스 일정 route·keyword — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyKyowontourScheduleExpressionToRows } from '@/lib/kyowontour-register-api-schedule'
import { applyKyowontourScheduleImageKeywordsToRows } from '@/lib/kyowontour-schedule-image-keyword'
import { firstMatchingScheduleCityEn, firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import {
  normScheduleImageKeywordKey,
  scheduleImageKeywordsSemanticallyOverlap,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import { isRegisterScheduleRoutePlaceNoise } from '@/lib/register-schedule-route-place-noise'
import { sanitizeRegisterScheduleRouteText } from '@/lib/register-schedule-route-place-noise'

describe('kyowontour Beijing CBP151 route + imageKeyword', () => {
  it('maps 자금성·천안문 as spots; bare 북경 is city hub Beijing', () => {
    expect(firstMatchingScheduleSpotEn('자금성')).toMatch(/Forbidden City/i)
    expect(firstMatchingScheduleSpotEn('천안문광장')).toMatch(/Tiananmen/i)
    expect(firstMatchingScheduleSpotEn('경산공원')).toMatch(/^Jingshan Park$/i)
    expect(firstMatchingScheduleSpotEn('스차하이')).toMatch(/Shichahai/i)
    expect(firstMatchingScheduleCityEn('북경')).toBe('Beijing')
    expect(firstMatchingScheduleCityEn('북경')).not.toMatch(/Forbidden/i)
  })

  it('strips VIP limo / rickshaw / show / lunchbox / silk market from route segments', () => {
    expect(isRegisterScheduleRoutePlaceNoise('VIP 리무진 버스')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('인력거')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('소림무술쇼 또는 경극')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('도시락 식사 후')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('전문대가')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('천안문광장')).toBe(false)
    expect(isRegisterScheduleRoutePlaceNoise('자금성')).toBe(false)

    expect(
      sanitizeRegisterScheduleRouteText(
        '북경 - VIP 리무진 버스 - 북경서커스 - 전문대가 - 천안문광장',
      ),
    ).toBe('북경 - 천안문광장')
    expect(
      sanitizeRegisterScheduleRouteText(
        '자금성 - 스차하이 - 인력거 - 경산공원 - 소림무술쇼 또는 경극 - 더플레이스',
      ),
    ).toBe('자금성 - 스차하이 - 경산공원 - 더플레이스')
    expect(sanitizeRegisterScheduleRouteText('도시락 식사 후')).toBeNull()
  })

  it('Jingshan short vs long form is semantic overlap; Manzhouli≠Matryoshka', () => {
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
  })

  it('CBP151-like 4-day — clean route a-b-c + distinct kw1/kw2', () => {
    const expressed = applyKyowontourScheduleExpressionToRows([
      {
        day: 1,
        title: '북경 · 천안문광장',
        description: '역사 유적과 도심 광장',
        routeText: '북경 - VIP 리무진 버스 - 북경서커스 - 전문대가 - 천안문광장',
        imageKeyword: '',
        imageKeyword2: null as string | null,
      },
      {
        day: 2,
        title: '팔달령만리장성 · 올림픽경기장 외관',
        description: '역사 유적',
        routeText: '팔달령만리장성 - 명13릉 - 이화원 - 올림픽경기장 외관',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '자금성 · 더플레이스',
        description: '역사 유적',
        routeText: '자금성 - 스차하이 - 인력거 - 경산공원 - 소림무술쇼 또는 경극 - 더플레이스',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '도시락 식사 후',
        description: '귀국',
        routeText: '도시락 식사 후',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ])

    expect(expressed[0]?.routeText).toBe('북경 - 천안문광장')
    expect(expressed[0]?.routeText).not.toMatch(/리무진|서커스|전문대/)
    expect(expressed[2]?.routeText).toBe('자금성 - 스차하이 - 경산공원 - 더플레이스')
    expect(expressed[2]?.routeText).not.toMatch(/인력거|경극|쇼/)
    expect(expressed[3]?.routeText == null || expressed[3]?.routeText === '').toBe(true)

    const out = applyKyowontourScheduleImageKeywordsToRows(expressed, {
      productDestination: '북경',
      productTitle: '북경 4일',
    })

    const d1 = out[0]!
    expect(String(d1.imageKeyword)).toMatch(/Tiananmen/i)
    expect(String(d1.imageKeyword)).not.toMatch(/Forbidden City/i)
    expect(
      scheduleImageKeywordsSemanticallyOverlap(
        String(d1.imageKeyword ?? ''),
        String(d1.imageKeyword2 ?? ''),
      ),
    ).toBe(false)

    const d2 = out[1]!
    expect(String(d2.imageKeyword)).toMatch(/Great Wall/i)
    expect(String(d2.imageKeyword2)).toMatch(/Summer Palace|Ming Tombs|Stadium/i)
    expect(normScheduleImageKeywordKey(String(d2.imageKeyword))).not.toBe(
      normScheduleImageKeywordKey(String(d2.imageKeyword2 ?? '')),
    )

    const d3 = out[2]!
    expect(String(d3.imageKeyword)).toMatch(/Forbidden City/i)
    expect(String(d3.imageKeyword2 ?? '')).toMatch(/Shichahai|Jingshan|The Place/i)
    expect(
      scheduleImageKeywordsSemanticallyOverlap(
        String(d3.imageKeyword ?? ''),
        String(d3.imageKeyword2 ?? ''),
      ),
    ).toBe(false)
    expect(String(d3.imageKeyword2 ?? '').toLowerCase()).not.toBe('jingshan park')
  })
})
