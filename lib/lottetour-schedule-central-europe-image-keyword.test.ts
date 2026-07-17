/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 프라하·동유럽 명소 — manifest
 * REGRESSION-FREEZE[register-schedule-route-place-noise]: outlet·한영 도시 중복 — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyLottetourScheduleImageKeywordsToRows } from '@/lib/lottetour-schedule-image-keyword'
import { applyLottetourScheduleExpressionToRows } from '@/lib/lottetour-register-api-schedule'
import { sanitizeRegisterScheduleRouteText } from '@/lib/register-schedule-route-place-noise'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'
import { isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'

describe('lottetour central Europe schedule quality', () => {
  it('maps Prague Castle / Charles Bridge / Hallstatt from Korean route', () => {
    expect(firstMatchingScheduleSpotEn('프라하 성')).toMatch(/Prague Castle/i)
    expect(firstMatchingScheduleSpotEn('카를교')).toMatch(/Charles Bridge/i)
    expect(firstMatchingScheduleSpotEn('할슈타트')).toMatch(/Hallstatt/i)
    expect(firstMatchingScheduleSpotEn('카를로비바리')).toMatch(/Karlovy Vary/i)
  })

  it('strips Designer Outlet and Sound of Music from routeText', () => {
    expect(
      sanitizeRegisterScheduleRouteText(
        '브르노 - 브라티슬라바 - 부다페스트 - DESIGNER OUTLET PANDORF',
      ),
    ).toBe('브르노 - 브라티슬라바 - 부다페스트')
    expect(
      sanitizeRegisterScheduleRouteText(
        '린츠 - 잘쯔부르크 - 짤즈캄머굿 - 할슈타트 - 체스케 부데요비체 - Sound of Music',
      ),
    ).not.toMatch(/Sound of Music|OUTLET|PANDORF/i)
  })

  it('dedupes Korean/English city pairs in routeText', () => {
    expect(sanitizeRegisterScheduleRouteText('비엔나(Vienna) - 린츠 - Vienna - Linz')).toBe(
      '비엔나 - 린츠',
    )
  })

  it('blocks Sound of Music / Designer Outlet as image keywords', () => {
    expect(isBlockedScheduleImageKeyword('Sound of Music')).toBe(true)
    expect(isBlockedScheduleImageKeyword('DESIGNER OUTLET PANDORF')).toBe(true)
  })

  it('apply keywords — landmarks not bare Prague / outlet / movie title', () => {
    const expressed = applyLottetourScheduleExpressionToRows([
      {
        day: 1,
        title: '프라하',
        description: '프라하 성 관광',
        routeText: '프라하 - 프라하 성',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '프라하',
        description: '카를로비바리',
        routeText: '프라하 - 카를로비바리 - 플젠',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '브르노',
        description: '부다페스트 이동',
        routeText: '브르노 - 브라티슬라바 - 부다페스트 - DESIGNER OUTLET PANDORF',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 7,
        title: '린츠',
        description: '할슈타트',
        routeText: '린츠 - 잘쯔부르크 - 짤즈캄머굿 - 할슈타트 - Sound of Music',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 9,
        title: '숙박 없음(귀국)',
        description: '귀국',
        routeText: '',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ])
    const out = applyLottetourScheduleImageKeywordsToRows(expressed, {
      productDestination: '체코',
      productTitle: '프라하 동유럽 9일',
    })
    expect(out[0]?.routeText).toMatch(/프라하\s*성/)
    expect(out[0]?.imageKeyword).toMatch(/Prague Castle|Charles Bridge|Old Town/i)
    expect(isBareCityOrCountryKeyword(out[0]?.imageKeyword ?? '')).toBe(false)
    expect(out[1]?.imageKeyword).toMatch(/Karlovy Vary|Plzen/i)
    expect(String(out[3]?.imageKeyword ?? '') + String(out[3]?.imageKeyword2 ?? '')).not.toMatch(
      /OUTLET|Sound of Music|PANDORF/i,
    )
    expect(out[3]?.imageKeyword).toMatch(/Hallstatt|Salzburg|Salzkammergut|Linz|Hohensalzburg/i)
    expect([out[3]?.imageKeyword, out[3]?.imageKeyword2].join(' ')).toMatch(
      /Hallstatt|Salzburg|Salzkammergut/i,
    )
    expect(out[0]?.description).not.toBe(out[3]?.description)
  })
})
