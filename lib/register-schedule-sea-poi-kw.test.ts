/**
 * REGRESSION-FREEZE[register-schedule-sea-poi-kw]: 보홀·세부 한글 route → imageKeyword — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyHanatourScheduleImageKeywordsToRows } from '@/lib/hanatour-schedule-image-keyword'
import { splitRouteTextPlaceSegments } from '@/lib/register-schedule-llm-image-keyword-fallback'

describe('register-schedule-sea-poi-kw', () => {
  it('normalizes CMS underscore compounds in route segments', () => {
    expect(splitRouteTextPlaceSegments('보홀_초콜릿힐 - 노스젠 밤부브릿지 선셋')).toEqual([
      '보홀 초콜릿힐',
      '노스젠 밤부브릿지 선셋',
    ])
  })

  it('maps Bohol 2030-style Korean routeText to English landmarks', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '1일차',
          description: '',
          routeText: null,
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '노스젠',
          description: '',
          routeText: '노스젠 밤부브릿지 선셋 - 맹그로브_노스젠 밤부브릿지',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: 'ICM',
          description: '',
          routeText: '보홀 아일랜드 시티몰 - 보홀_초콜릿힐',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        productDestination: '보홀',
        productTitle: '[2030전용] 보홀 5일 #헤난알로나비치',
      },
    )
    expect(String(out.find((r) => r.day === 2)?.imageKeyword ?? '')).toMatch(/Bamboo Bridge/i)
    expect(String(out.find((r) => r.day === 4)?.imageKeyword ?? '')).toMatch(/Chocolate Hills/i)
  })

  it('AAP218 Bangkok day4 — Bang Luang not NYC Central Park (Dusit)', () => {
    // REGRESSION-FREEZE[register-schedule-sea-poi-kw]: AAP218 방루앙·두짓≠NYC Central Park — manifest
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 4,
          title: '방루앙 운하마을 · 왓빡남',
          description: '',
          routeText: '방루앙 운하마을 - 왓빡남 - 아티스트 하우스 - 두짓 센트럴 파크',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        productDestination: '방콕',
        productTitle:
          '방콕 5일 #타이쿠킹클래스 #올드타운투어 #빈티지짜뚜짝시장 #방루앙운하마을 #두짓센트럴파크',
        supplierKey: 'hanatour',
      },
    )
    const kw = String(out[0]?.imageKeyword ?? '')
    expect(kw).not.toMatch(/Central Park New York|^Central Park$/i)
    expect(kw).toMatch(/Bang Luang|Wat Paknam|Artist House|Dusit Central Park/i)
  })

  it('AVP227 Nha Trang day2 — pirate hopping not Cebu', () => {
    // REGRESSION-FREEZE[register-schedule-sea-poi-kw]: AVP227 나트랑 해적호핑≠Cebu Pirate — manifest
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '나트랑 해적 호핑 · 나트랑 레일웨이 카페',
          description: '',
          routeText: '나트랑 해적 호핑 - 나트랑 레일웨이 카페 - 오늘의 감성카페 - 스카이라이트',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        productDestination: '나트랑',
        productTitle: '나트랑 5일 #해적호핑 #레일웨이카페 #판랑사막 #코코배',
        supplierKey: 'hanatour',
      },
    )
    const kw1 = String(out[0]?.imageKeyword ?? '')
    const kw2 = String(out[0]?.imageKeyword2 ?? '')
    expect(kw1).not.toMatch(/Cebu/i)
    expect(kw2).not.toMatch(/Cebu/i)
    expect(kw1).toMatch(/Nha Trang.*Pirate|Pirate.*Nha Trang/i)
  })

  it('AYP261 KK free day — 코타키나발루≠Kinabalu Park', () => {
    // REGRESSION-FREEZE[register-schedule-sea-poi-kw]: AYP261 코타키나발루≠Kinabalu Park — manifest
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 4,
          title: '자유 일정 · 코타키나발루',
          description: '',
          routeText: '코타키나발루 자유 일정',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        productDestination: '코타키나발루',
        productTitle: '코타키나발루 5일 #시티모스크 #핑크모스크 #바나나보트 #자유일정',
        supplierKey: 'hanatour',
      },
    )
    const kw1 = String(out[0]?.imageKeyword ?? '')
    const kw2 = String(out[0]?.imageKeyword2 ?? '')
    expect(kw1).not.toMatch(/Kinabalu Park/i)
    expect(kw2).not.toMatch(/Kinabalu Park/i)
    expect(`${kw1} ${kw2}`).toMatch(/Kota Kinabalu/i)
  })

  it('JKP135 Fukuoka day2 — Shikanoshima not Tottori Sand Dunes', () => {
    // REGRESSION-FREEZE[register-schedule-sea-poi-kw]: JKP135 시카노시마≠Tottori — manifest
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '규슈 입국',
          description: '',
          routeText: '규슈 입국',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '시카노시마 해안선 사이클링',
          description: '',
          routeText:
            '시카노시마 해안선 사이클링 코스 - 시카시마 사이클링 코스 - 후쿠오카의 청량한 바다를 가르는 사이클링',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '규슈 출발 및 인천 귀국',
          description: '',
          routeText: '규슈 출발 및 인천 귀국',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        productDestination: '규슈',
        productTitle: '규슈·후쿠오카 3일 #해안가 사이클링 #시카노시마',
        supplierKey: 'hanatour',
      },
    )
    const d2 = out.find((r) => r.day === 2)
    const kw1 = String(d2?.imageKeyword ?? '')
    const kw2 = String(d2?.imageKeyword2 ?? '')
    expect(kw1).not.toMatch(/Tottori/i)
    expect(kw2).not.toMatch(/Tottori/i)
    expect(`${kw1} ${kw2}`).toMatch(/Shikanoshima/i)
  })
})
