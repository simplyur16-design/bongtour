/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot] — ybtour prebuild
 * REGRESSION-FREEZE[ybtour-schedule-image-keyword-distinct]
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyYbtourScheduleImageKeywordsToRows,
  classifyYbtourDayKind,
  classifyYbtourScheduleCardDayKind,
  isYbtourDomesticHubToken,
  pickYbtourImageKeywordsFromRouteText,
  resolveYbtourPrimaryKeyword,
  resolveYbtourSecondaryKeyword,
} from '../lib/ybtour-schedule-image-keyword'

describe('isYbtourDomesticHubToken', () => {
  it('국내 출발지 토큰을 true로', () => {
    assert.equal(isYbtourDomesticHubToken('인천'), true)
    assert.equal(isYbtourDomesticHubToken('김포'), true)
    assert.equal(isYbtourDomesticHubToken('부산'), true)
    assert.equal(isYbtourDomesticHubToken('ICN'), true)
    assert.equal(isYbtourDomesticHubToken('Hong Kong'), false)
  })
})

describe('pickYbtourImageKeywordsFromRouteText (에어텔·레거시 KO→EN)', () => {
  it('A-B-C-D에서 허브 제외 후 앞 두 곳', () => {
    assert.deepEqual(
      pickYbtourImageKeywordsFromRouteText('인천 - 두바이 - 카이로'),
      { imageKeyword: 'Dubai', imageKeyword2: 'Cairo' },
    )
    assert.deepEqual(pickYbtourImageKeywordsFromRouteText('룩소르 - 후르가다'), {
      imageKeyword: 'Luxor',
      imageKeyword2: 'Hurghada',
    })
  })
})

describe('classifyYbtourDayKind (레거시)', () => {
  it('홍콩 4일 — flight / touring / free', () => {
    assert.equal(
      classifyYbtourDayKind(
        '인천 국제공항에서 출발하여 홍콩 국제공항 도착',
        '인천 출발 및 홍콩 도착',
        '인천 - 홍콩',
        1,
        4,
      ),
      'flight',
    )
    assert.equal(
      classifyYbtourDayKind(
        '하버 시티와 소호 거리, 빅토리아 피크 관광',
        '홍콩 시내 핵심 관광',
        '홍콩 - 하버 시티 - 소호 거리 - 미드레벨 에스컬레이터 - 타이쿤 - 빅토리아 피크',
        2,
        4,
      ),
      'touring',
    )
  })
})

describe('classifyYbtourScheduleCardDayKind', () => {
  it('1일차 movement, 4일차 return_home', () => {
    assert.equal(
      classifyYbtourScheduleCardDayKind(
        1,
        4,
        '인천 출발 및 홍콩 도착\n인천 국제공항에서 출발하여 홍콩 국제공항 도착\n인천 - 홍콩',
      ),
      'movement',
    )
    assert.equal(
      classifyYbtourScheduleCardDayKind(
        4,
        4,
        '인천 국제공항 도착\n홍콩 출발 후 인천 국제공항 도착\n홍콩 - 인천',
      ),
      'return_home',
    )
  })
})

describe('applyYbtourScheduleImageKeywordsToRows', () => {
  it('홍콩 — LLM 1·2순위 우선, movement/return imageKeyword2 null', () => {
    const out = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '인천 출발 및 홍콩 도착',
          description: '인천 국제공항에서 출발하여 홍콩 국제공항 도착',
          routeText: '인천 - 홍콩',
          imageKeyword: 'Hong Kong',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '홍콩 시내 핵심 관광',
          description: '하버 시티와 소호 거리, 빅토리아 피크 관광',
          routeText: '홍콩 - 하버 시티 - 소호 거리 - 빅토리아 피크',
          imageKeyword: 'Harbour City Hong Kong',
          imageKeyword2: 'SoHo Hong Kong',
        },
        {
          day: 4,
          title: '인천 국제공항 도착',
          description: '홍콩 출발 후 인천 국제공항 도착',
          routeText: '홍콩 - 인천',
          imageKeyword: 'Victoria Peak',
          imageKeyword2: 'Peak Tram',
        },
      ],
      { productDestination: 'Hong Kong' },
    )

    assert.equal(out.find((r) => r.day === 1)!.imageKeyword, 'Hong Kong')
    assert.equal(out.find((r) => r.day === 1)!.imageKeyword2, null)
    assert.equal(out.find((r) => r.day === 2)!.imageKeyword, 'Harbour City Hong Kong')
    assert.equal(out.find((r) => r.day === 2)!.imageKeyword2, 'SoHo Hong Kong')
    assert.equal(out.find((r) => r.day === 4)!.imageKeyword2, null)
  })

  it('이집트 — 환각 LLM 거부, routeText·본문 추론', () => {
    const out = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 6,
          title: '홍해의 휴양지 후르가다로 이동',
          description: '나일강 크루즈에서 하선하여 후르가다로 이동',
          routeText: '룩소르 - 후르가다',
          imageKeyword: 'Osaka Castle',
          imageKeyword2: 'Forbidden City',
        },
        {
          day: 7,
          title: '후르가다 홍해 리조트 자유 휴양',
          description: '후르가다 리조트에서 전일 자유',
          routeText: '후르가다',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      { productDestination: '이집트' },
    )

    assert.equal(out.find((r) => r.day === 6)!.imageKeyword, 'Luxor')
    assert.equal(out.find((r) => r.day === 6)!.imageKeyword2, 'Hurghada')
    assert.equal(out.find((r) => r.day === 7)!.imageKeyword, 'Hurghada')
  })

  it('LLM 동일 랜드마크 반복 → dedupe 후 관광 일차 kw2 유지 (회귀)', () => {
    const out = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '다낭',
          description: '미케 비치',
          routeText: 'Da Nang - My Khe Beach',
          imageKeyword: 'Ba Na Hills',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '호이안',
          description: '호이안 올드타운',
          routeText: 'Da Nang - Hoi An Ancient Town',
          imageKeyword: 'Ba Na Hills',
          imageKeyword2: null,
        },
      ],
      { productDestination: 'Vietnam' },
    )
    const d2 = out.find((r) => r.day === 2)!
    const d3 = out.find((r) => r.day === 3)!
    assert.ok(d2.imageKeyword2?.trim(), `day2 kw2 empty: ${d2.imageKeyword2}`)
    assert.ok(d3.imageKeyword2?.trim(), `day3 kw2 empty: ${d3.imageKeyword2}`)
    assert.notEqual(
      norm(d2.imageKeyword!),
      norm(d2.imageKeyword2!),
      'day2 kw1 must differ from kw2',
    )
  })
})

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

describe('resolveYbtourPrimaryKeyword / resolveYbtourSecondaryKeyword', () => {
  it('tourism — LLM 1·2순위', () => {
    const row = {
      day: 2,
      routeText: '홍콩 - 하버 시티 - 소호 거리',
      imageKeyword: 'Harbour City Hong Kong',
      imageKeyword2: 'SoHo Hong Kong',
    }
    const primary = resolveYbtourPrimaryKeyword(row, 'tourism', 'Hong Kong')
    const secondary = resolveYbtourSecondaryKeyword(row, primary, 'tourism', 'Hong Kong')
    assert.equal(primary, 'Harbour City Hong Kong')
    assert.equal(secondary, 'SoHo Hong Kong')
  })
})
