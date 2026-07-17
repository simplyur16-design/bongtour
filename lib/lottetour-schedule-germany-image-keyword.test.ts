/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 독일 일주 명소 — manifest
 * REGRESSION-FREEZE[register-schedule-route-place-noise]: 독일·유럽 admin·교통 세그먼트 — manifest
 * REGRESSION-FREEZE[lottetour-schedule-expression]: 독일 일주 vibe 분화 — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyLottetourScheduleImageKeywordsToRows } from '@/lib/lottetour-schedule-image-keyword'
import { applyLottetourScheduleExpressionToRows } from '@/lib/lottetour-register-api-schedule'
import { sanitizeRegisterScheduleRouteText } from '@/lib/register-schedule-route-place-noise'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'

describe('lottetour Germany schedule quality', () => {
  it('maps German landmarks from Korean route segments', () => {
    expect(firstMatchingScheduleSpotEn('노이슈반슈타인')).toMatch(/Neuschwanstein/i)
    expect(firstMatchingScheduleSpotEn('뤼데스하임')).toMatch(/Rudesheim|Rhine/i)
    expect(firstMatchingScheduleSpotEn('로텐부르크')).toMatch(/Rothenburg/i)
    expect(firstMatchingScheduleSpotEn('헤렌킴제')).toMatch(/Herrenchiemsee/i)
    expect(firstMatchingScheduleSpotEn('베를린')).toMatch(/Brandenburg/i)
    expect(firstMatchingScheduleSpotEn('드레스덴')).toMatch(/Dresden|Frauenkirche/i)
    expect(firstMatchingScheduleSpotEn('포츠담')).toMatch(/Sanssouci/i)
  })

  it('strips 필독사항·내부입장·ICE and KO/EN city dups', () => {
    expect(
      sanitizeRegisterScheduleRouteText('프랑크푸르트 - 필독사항'),
    ).toBe('프랑크푸르트')
    expect(
      sanitizeRegisterScheduleRouteText(
        '캠프텐 - 퓌센 - 뮌헨 - 내부입장 - 조망 - 성모교회',
      ),
    ).toBe('캠프텐 - 퓌센 - 뮌헨 - 성모교회')
    expect(
      sanitizeRegisterScheduleRouteText(
        '프랑크푸르트 - 뤼데스하임 - 로텐부르크 - 캠프텐 - 켐프텐 - KEMPTEN',
      ),
    ).toBe('프랑크푸르트 - 뤼데스하임 - 로텐부르크 - 캠프텐')
    expect(
      sanitizeRegisterScheduleRouteText('베를린 - 프랑크푸르트 - ICE - FRANKFURT'),
    ).toBe('베를린 - 프랑크푸르트')
    expect(
      sanitizeRegisterScheduleRouteText('뉘른베르크 - 밤베르크 - 드레스덴 - DRESDEN'),
    ).toBe('뉘른베르크 - 밤베르크 - 드레스덴')
  })

  it('apply keywords — landmarks not bare ALL-CAPS cities; vibe differs by day', () => {
    const expressed = applyLottetourScheduleExpressionToRows([
      {
        day: 1,
        title: '프랑크푸르트',
        description: '도착',
        routeText: '프랑크푸르트 - 필독사항',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '프랑크푸르트',
        description: '라인',
        routeText: '프랑크푸르트 - 뤼데스하임 - 로텐부르크 - 캠프텐 - 켐프텐 - KEMPTEN',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '캠프텐',
        description: '성',
        routeText: '캠프텐 - 퓌센 - 뮌헨 - 내부입장 - 조망 - 성모교회',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '뮌헨',
        description: '킴제',
        routeText: '뮌헨 - 킴제 - 뉘른베르크 - 내부입장',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 5,
        title: '뉘른베르크',
        description: '드레스덴',
        routeText: '뉘른베르크 - 밤베르크 - 드레스덴 - DRESDEN',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 6,
        title: '드레스덴',
        description: '베를린',
        routeText: '드레스덴 - 포츠담 - 베를린 - 정원입장 - BERLIN',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 7,
        title: '베를린',
        description: '구박물관',
        routeText: '베를린 - 구박물관 - 내부관람',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 8,
        title: '베를린',
        description: 'ICE',
        routeText: '베를린 - 프랑크푸르트 - ICE - FRANKFURT',
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
      productDestination: '독일',
      productTitle: '독일 완전일주 9일',
    })

    expect(out[1]?.routeText).not.toMatch(/KEMPTEN|필독|내부입장|ICE/i)
    expect(out[1]?.routeText).toMatch(/뤼데스하임/)
    expect(out[1]?.imageKeyword).toMatch(/Rudesheim|Rothenburg/i)
    expect(isBareCityOrCountryKeyword(out[1]?.imageKeyword ?? '')).toBe(false)
    expect(String(out[1]?.imageKeyword ?? '')).not.toMatch(/^KEMPTEN$/i)

    expect(out[2]?.imageKeyword).toMatch(/Neuschwanstein|Frauenkirche|Marienplatz/i)
    expect(out[3]?.imageKeyword).toMatch(/Herrenchiemsee|Marienplatz|Nuremberg/i)
    expect(out[4]?.imageKeyword).toMatch(/Dresden|Bamberg|Nuremberg/i)
    expect(out[5]?.imageKeyword).toMatch(/Brandenburg|Sanssouci|Dresden/i)
    expect(out[6]?.imageKeyword).toMatch(/Altes Museum|Brandenburg|Cecilienhof/i)

    expect(out[1]?.description).not.toBe(out[2]?.description)
    expect(out[1]?.description).not.toMatch(/하루 동안 여러 장면/)
    expect(out[5]?.description).not.toMatch(/하루 동안 여러 장면/)
    expect(out[8]?.description).toMatch(/귀국|마무리|이동 중심/)
  })
})
