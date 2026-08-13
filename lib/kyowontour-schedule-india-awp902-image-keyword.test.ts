/**
 * REGRESSION-FREEZE[kyowontour-schedule-expression]: AWP902 India — Lodhi≠Qutub bleed · vibe 분화 — manifest
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: India Lodhi/Bahai/Akshardham · 자이푸르≠Hawa — manifest
 * REGRESSION-FREEZE[register-schedule-route-place-noise]: India 릭샤·이른기상·도시락 — manifest
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: Khajuraho Complex≡Temples — manifest
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: India Varanasi/Khajuraho ≠ golden — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyKyowontourScheduleExpressionToRows } from '@/lib/kyowontour-register-api-schedule'
import { applyKyowontourScheduleImageKeywordsToRows } from '@/lib/kyowontour-schedule-image-keyword'
import { firstMatchingScheduleCityEn, firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { scheduleImageKeywordsSemanticallyOverlap } from '@/lib/register-schedule-llm-image-keyword-fallback'
import {
  isRegisterScheduleRoutePlaceNoise,
  sanitizeRegisterScheduleRouteText,
} from '@/lib/register-schedule-route-place-noise'
import { composeRegisterScheduleExtendedRegionVibeDescription } from '@/lib/register-schedule-region-vibe-extended'

describe('kyowontour India AWP902 route + imageKeyword + vibe', () => {
  it('maps Lodhi / Lotus / Akshardham / Ganga; Jaipur is city hub not Hawa', () => {
    expect(firstMatchingScheduleSpotEn('로디가든')).toMatch(/^Lodhi Garden$/i)
    expect(firstMatchingScheduleSpotEn('바하이 사원')).toMatch(/^Lotus Temple$/i)
    expect(firstMatchingScheduleSpotEn('악차르담 사원')).toMatch(/Akshardham/i)
    expect(firstMatchingScheduleSpotEn('갠지스강')).toMatch(/^Ganges River$/i)
    expect(firstMatchingScheduleSpotEn('사르나트')).toMatch(/^Sarnath$/i)
    expect(firstMatchingScheduleSpotEn('꾸뜹미나르')).toMatch(/^Qutub Minar$/i)
    expect(firstMatchingScheduleSpotEn('하와마할')).toMatch(/^Hawa Mahal$/i)
    expect(firstMatchingScheduleSpotEn('암베르 성')).toMatch(/^Amber Fort$/i)
    expect(firstMatchingScheduleCityEn('자이푸르')).toBe('Jaipur')
    expect(firstMatchingScheduleCityEn('자이푸르')).not.toMatch(/Hawa/i)
  })

  it('strips 릭샤 / 이른기상·도시락 from India route segments', () => {
    expect(isRegisterScheduleRoutePlaceNoise('릭샤')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('이른 기상 후 도시락 지참 후 델리 공항')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('사르나트')).toBe(false)
    expect(
      sanitizeRegisterScheduleRouteText(
        '이른 기상 후 도시락 지참 후 델리 공항 - 바라나시 - 사르나트 - 릭샤 - 아르띠뿌자',
      ),
    ).toBe('바라나시 - 사르나트 - 아르띠뿌자')
  })

  it('Khajuraho Temple Complex ≡ Temples is semantic overlap', () => {
    expect(
      scheduleImageKeywordsSemanticallyOverlap('Khajuraho Temple Complex', 'Khajuraho Temples'),
    ).toBe(true)
    expect(scheduleImageKeywordsSemanticallyOverlap('Taj Mahal', 'Agra Fort')).toBe(false)
  })

  it('Varanasi / Khajuraho vibe ≠ golden triangle copy', () => {
    const varanasi = composeRegisterScheduleExtendedRegionVibeDescription(
      ['갠지스강'],
      '갠지스강 - 아르띠뿌자',
    )
    expect(varanasi).toMatch(/갠지스|아르띠뿌자|바라나시/)
    expect(varanasi).not.toMatch(/골든트라이앵글/)

    const khaj = composeRegisterScheduleExtendedRegionVibeDescription(
      ['서부 사원군'],
      '서부 사원군 & 동부 사원군 - 카주라호 기차역',
    )
    expect(khaj).toMatch(/사원|조각|유적|카주라호/)
    expect(khaj).not.toMatch(/골든트라이앵글/)

    const golden = composeRegisterScheduleExtendedRegionVibeDescription(
      ['타지마할'],
      '타지마할 - 아그라 성',
    )
    expect(golden).toMatch(/타지마할|아그라|유적/)
  })

  it('AWP902-like 8-day — Day8 Lodhi not Qutub; Khajuraho kw1≠kw2; golden not on Varanasi day', () => {
    const expressed = applyKyowontourScheduleExpressionToRows([
      {
        day: 1,
        title: '인도 도착비자',
        description: '',
        routeText: '인도 도착비자',
        imageKeyword: '',
        imageKeyword2: null as string | null,
      },
      {
        day: 2,
        title: '이른 기상 후 도시락 지참 후 델리 공항 · 아르띠뿌자',
        description: '',
        routeText:
          '이른 기상 후 도시락 지참 후 델리 공항 - 바라나시 - 사르나트 - 릭샤 - 아르띠뿌자',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '갠지스강',
        description: '',
        routeText: '갠지스강 - 아르띠뿌자',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '서부 사원군 & 동부 사원군 · 관광 후 카주라호 기차역',
        description: '',
        routeText: '서부 사원군 & 동부 사원군 - 관광 후 카주라호 기차역',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 5,
        title: '타지마할 · 아바네리 찬드',
        description: '',
        routeText: '타지마할 - 아그라 성 - 관광 후 자이푸르 이동 - 시칸드라성 - 아바네리 찬드',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 6,
        title: '암베르 성 · 나하르가르 성 일몰',
        description: '',
        routeText: '암베르 성 - 하와마할 - 잔타르만타르 - 자이푸르 시장 워킹 - 나하르가르 성 일몰',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 7,
        title: '인디아게이트 · 꾸뜹미나르',
        description: '',
        routeText: '인디아게이트 - 구르드와라 방글라 사힙 - 후마윤 무덤 - 꾸뜹미나르',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 8,
        title: '로디가든 · 악차르담 사원',
        description: '',
        routeText: '로디가든 - 바하이 사원 - 악차르담 사원',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ])

    expect(expressed[1]?.description ?? '').toMatch(/바라나시|사르나트|아르띠뿌자/)
    expect(expressed[1]?.description ?? '').not.toMatch(/골든트라이앵글/)
    expect(expressed[2]?.description ?? '').toMatch(/갠지스|아르띠뿌자/)
    expect(expressed[2]?.description ?? '').not.toMatch(/골든트라이앵글/)
    expect(expressed[3]?.description ?? '').toMatch(/사원|조각|유적|카주라호/)
    expect(expressed[3]?.description ?? '').not.toMatch(/골든트라이앵글/)
    expect(expressed[4]?.description ?? '').toMatch(/타지마할|아그라|자이푸르/)

    expect(expressed[1]?.routeText ?? '').not.toMatch(/릭샤|도시락|이른\s*기상/)
    expect(expressed[1]?.routeText ?? '').toMatch(/바라나시/)
    expect(expressed[1]?.routeText ?? '').toMatch(/사르나트/)

    const withKw = applyKyowontourScheduleImageKeywordsToRows(expressed, {
      productTitle: '인도9일 [대한항공]',
      productDestination: '인도',
    })

    const d4 = withKw[3]!
    expect(d4.imageKeyword).toMatch(/Khajuraho/i)
    if (d4.imageKeyword2) {
      expect(
        scheduleImageKeywordsSemanticallyOverlap(String(d4.imageKeyword), String(d4.imageKeyword2)),
      ).toBe(false)
    }

    const d5 = withKw[4]!
    expect(d5.imageKeyword).toMatch(/Taj Mahal/i)
    // kw2 = Agra Fort 또는 route 후순위 Chand Baori(아바네리) — 둘 다 당일 명소
    expect(d5.imageKeyword2 ?? '').toMatch(/Agra Fort|Chand Baori|Sikandra/i)

    const d6 = withKw[5]!
    expect(d6.imageKeyword).toMatch(/^Amber Fort$/i)
    // kw2 prefers later route POI (Hawa / Jantar / Nahargarh) — short landmark, no India/pink noise
    expect(d6.imageKeyword2 ?? '').toMatch(/Hawa Mahal|Jantar Mantar|Nahargarh Fort/i)
    expect(String(d6.imageKeyword)).not.toMatch(/India|pink|facade/i)
    expect(String(d6.imageKeyword2)).not.toMatch(/India|pink|facade/i)

    const d7 = withKw[6]!
    expect(d7.imageKeyword).toMatch(/India Gate/i)
    expect(String(d7.imageKeyword2 ?? d7.imageKeyword)).toMatch(/Qutub|Gurudwara|Humayun/i)

    const d8 = withKw[7]!
    expect(d8.imageKeyword).toMatch(/Lodhi Garden|Lotus Temple|Akshardham/i)
    expect(String(d8.imageKeyword)).not.toMatch(/Qutub/i)
    expect(String(d8.imageKeyword2 ?? '')).not.toMatch(/Qutub/i)
  })
})
