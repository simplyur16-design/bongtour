import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyYbtourScheduleImageKeywordsToRows,
  classifyYbtourDayKind,
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

describe('pickYbtourImageKeywordsFromRouteText', () => {
  it('A-B-C-D에서 허브 제외 후 앞 두 곳', () => {
    assert.deepEqual(
      pickYbtourImageKeywordsFromRouteText('인천 - 두바이 - 카이로'),
      { imageKeyword: 'Dubai', imageKeyword2: 'Cairo' },
    )
    assert.deepEqual(pickYbtourImageKeywordsFromRouteText('룩소르 - 후르가다'), {
      imageKeyword: 'Luxor',
      imageKeyword2: 'Hurghada',
    })
    assert.deepEqual(pickYbtourImageKeywordsFromRouteText('후르가다'), {
      imageKeyword: 'Hurghada',
      imageKeyword2: null,
    })
  })

  it('관광 일차 — routeText 순서 1·2순위', () => {
    const kw = pickYbtourImageKeywordsFromRouteText(
      '카이로 - 그랜드 이집션 뮤지엄 - 올드 카이로 - 칸 엘 칼릴리 시장',
    )
    assert.equal(kw.imageKeyword, 'Cairo')
    assert.equal(kw.imageKeyword2, 'Grand Egyptian Museum')
  })
})

describe('classifyYbtourDayKind', () => {
  it('홍콩 4일 — 출발·귀국 flight, day2 touring, day3 free(세그먼트<3)', () => {
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
    assert.equal(
      classifyYbtourDayKind(
        '웡타이신 사원 관람 후 반나절 자유',
        '웡타이신 사원 및 반나절 자유 일정',
        '홍콩 - 웡타이신 사원 - 자유 일정 - 홍콩 국제공항',
        3,
        4,
      ),
      'touring',
    )
    assert.equal(
      classifyYbtourDayKind(
        '홍콩 출발 후 인천 국제공항 도착',
        '인천 국제공항 도착',
        '홍콩 - 인천',
        4,
        4,
      ),
      'flight',
    )
  })
})

describe('applyYbtourScheduleImageKeywordsToRows', () => {
  it('홍콩 — routeText 앞 두 관광지', () => {
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
          imageKeyword: 'Victoria Peaks',
          imageKeyword2: null,
        },
      ],
      { productDestination: 'Hong Kong' },
    )

    assert.equal(out.find((r) => r.day === 1)!.imageKeyword, 'Hong Kong')
    assert.equal(out.find((r) => r.day === 1)!.imageKeyword2, null)
    assert.equal(out.find((r) => r.day === 2)!.imageKeyword, 'Hong Kong')
    assert.equal(out.find((r) => r.day === 2)!.imageKeyword2, 'Harbour City Hong Kong')
    assert.equal(out.find((r) => r.day === 4)!.imageKeyword, 'Hong Kong')
    assert.equal(out.find((r) => r.day === 4)!.imageKeyword2, null)
  })

  it('이집트 — 후르가다·Osaka LLM 무시, routeText 2곳', () => {
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
        {
          day: 9,
          title: '기자 피라미드 관람',
          description: '피라미드와 스핑크스 관람',
          routeText: '카이로 - 기자 - 피라미드 - 스핑크스',
          imageKeyword: 'Osaka Castle',
          imageKeyword2: null,
        },
      ],
      { productDestination: '이집트' },
    )

    assert.deepEqual(
      { k1: out.find((r) => r.day === 6)!.imageKeyword, k2: out.find((r) => r.day === 6)!.imageKeyword2 },
      { k1: 'Luxor', k2: 'Hurghada' },
    )
    assert.equal(out.find((r) => r.day === 7)!.imageKeyword, 'Hurghada')
    assert.equal(out.find((r) => r.day === 7)!.imageKeyword2, null)
    assert.equal(out.find((r) => r.day === 9)!.imageKeyword, 'Cairo')
    assert.equal(out.find((r) => r.day === 9)!.imageKeyword2, 'Giza')
  })

  it('routeText 없으면 빈값', () => {
    const out = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 3,
          title: '자유 일정',
          description: '호텔에서 휴식',
          routeText: null,
          imageKeyword: 'Osaka Castle',
          imageKeyword2: 'Forbidden City',
        },
      ],
      { productDestination: '이집트' },
    )
    assert.equal(out[0]!.imageKeyword, '')
    assert.equal(out[0]!.imageKeyword2, null)
  })
})

describe('resolveYbtourPrimaryKeyword / resolveYbtourSecondaryKeyword', () => {
  it('routeText 1·2순위', () => {
    const row = {
      day: 2,
      routeText: '홍콩 - 하버 시티 - 소호 거리',
      imageKeyword: 'ignored',
      imageKeyword2: 'ignored',
    }
    const primary = resolveYbtourPrimaryKeyword(row, 'touring', 'Hong Kong')
    const secondary = resolveYbtourSecondaryKeyword(row, primary, 'touring', 'Hong Kong')
    assert.equal(primary, 'Hong Kong')
    assert.equal(secondary, 'Harbour City Hong Kong')
  })
})
