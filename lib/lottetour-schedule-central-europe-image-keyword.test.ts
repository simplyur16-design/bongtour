/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 프라하·동유럽 명소 — manifest
 * REGRESSION-FREEZE[register-schedule-route-place-noise]: outlet·한영 도시 중복 — manifest
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: EEP138 Dresden Semper·성모≠Prague — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyLottetourScheduleImageKeywordsToRows } from '@/lib/lottetour-schedule-image-keyword'
import { applyLottetourScheduleExpressionToRows } from '@/lib/lottetour-register-api-schedule'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
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

describe('EEP138 Dresden–Prague Christmas schedule keywords', () => {
  it('D2 Semperoper not Prague; D7 admin note soft-dup Prague not Havel', () => {
    expect(firstMatchingScheduleSpotEn('젬퍼 오페라')).toMatch(/Semper/i)
    expect(firstMatchingScheduleSpotEn('드레스덴 크리스마스마켓')).toMatch(/Christmas|Dresden/i)
    expect(firstMatchingScheduleSpotEn('드레스덴 성모 교회')).toMatch(/Frauenkirche|Dresden/i)

    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          title: '',
          description: '',
          routeText: "드레스덴 크리스마스마켓01 - 야경 명소 '드레스덴",
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '',
          description: '',
          routeText: '옛 작센 왕국의 영화가 피어나는 드레스덴 - 궁전 - 젬퍼 오페라 - 성모 교회',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '',
          description: '',
          routeText: '로텐부르크 크리스마스 마켓 - 슈니발렌 - 뉘른베르크 크리스마스 마켓',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '',
          description: '',
          routeText: '뉘른베르크 - 중앙 광장 - 카이저부르크',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 5,
          title: '',
          description: '',
          routeText: '체스키크룸로프 성 - 라트란 거리 - 체스키',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 6,
          title: '',
          description: '',
          routeText: '프라하 스트라호프 수도원 - 리에그로비 공원 - 하벨 시장 - 피크닉',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 7,
          title: '',
          description: '',
          routeText: '여행 전 필수 확인 사항',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'hanatour',
        productDestination: '프라하',
        productTitle: '드레스덴 뉘른베르크 프라하 크리스마스마켓',
        travelScope: 'package',
      },
    )
    const by = (d: number) => out.find((r) => r.day === d)!
    expect(String(by(1).imageKeyword ?? '')).toMatch(/Christmas|Dresden/i)
    expect(String(by(1).imageKeyword2 ?? '')).not.toMatch(/Frauenkirche|Semper/i)
    const d2 = `${by(2).imageKeyword ?? ''} ${by(2).imageKeyword2 ?? ''}`
    expect(d2).toMatch(/Semper|Frauenkirche/i)
    expect(d2).not.toMatch(/\bPrague\b/i)
    expect(String(by(2).imageKeyword ?? '')).not.toMatch(/^Prague$/i)
    expect(String(by(5).imageKeyword ?? '')).toMatch(/Krumlov/i)
    expect(String(by(6).imageKeyword ?? '')).toMatch(/Strahov|Riegrovy/i)
    expect(String(by(7).imageKeyword ?? '')).toMatch(/^Prague$/i)
    expect(String(by(7).imageKeyword ?? '')).not.toMatch(/Havel/i)
  })
})
