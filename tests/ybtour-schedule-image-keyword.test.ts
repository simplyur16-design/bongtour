import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyYbtourScheduleImageKeywordsToRows,
  classifyYbtourDayKind,
  isYbtourCrossContinentHallucinationKeyword,
  isYbtourDomesticHubToken,
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

describe('isYbtourCrossContinentHallucinationKeyword', () => {
  it('홍콩 목적지에서 Paris/Forbidden City는 환각', () => {
    assert.equal(isYbtourCrossContinentHallucinationKeyword('Paris', 'Hong Kong'), true)
    assert.equal(isYbtourCrossContinentHallucinationKeyword('Forbidden City', '홍콩'), true)
  })

  it('홍콩 목적지에서 SoHo/Wong Tai Sin은 환각 아님', () => {
    assert.equal(isYbtourCrossContinentHallucinationKeyword('SoHo Hong Kong', 'Hong Kong'), false)
    assert.equal(isYbtourCrossContinentHallucinationKeyword('Wong Tai Sin Temple', '홍콩'), false)
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

describe('applyYbtourScheduleImageKeywordsToRows — 홍콩 4일', () => {
  const hkOpts = { productDestination: 'Hong Kong' }

  const hkRows = [
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
      routeText:
        '홍콩 - 하버 시티 - 소호 거리 - 미드레벨 에스컬레이터 - 타이쿤 - 빅토리아 피크 - 피크트램(편도) - 1881 헤리티지 - 낭만의 거리 - 시계탑',
      imageKeyword: 'Harbour City Hong Kong',
      imageKeyword2: 'SoHo Hong Kong',
    },
    {
      day: 3,
      title: '웡타이신 사원 및 반나절 자유 일정',
      description: '웡타이신 사원 관람 후 반나절 자유',
      routeText: '홍콩 - 웡타이신 사원 - 자유 일정 - 홍콩 국제공항',
      imageKeyword: 'Wong Tai Sin Temple',
      imageKeyword2: 'Senado Square',
    },
    {
      day: 4,
      title: '인천 국제공항 도착',
      description: '홍콩 출발 후 인천 국제공항 도착',
      routeText: '홍콩 - 인천',
      imageKeyword: 'Victoria Peaks',
      imageKeyword2: null,
    },
  ]

  it('day1 Hong Kong/null · day2 det kw1 유지 + SoHo · day3 keep · day4 Hong Kong/null', () => {
    const out = applyYbtourScheduleImageKeywordsToRows(hkRows, hkOpts)
    const d1 = out.find((r) => r.day === 1)!
    const d2 = out.find((r) => r.day === 2)!
    const d3 = out.find((r) => r.day === 3)!
    const d4 = out.find((r) => r.day === 4)!

    assert.equal(d1.imageKeyword, 'Hong Kong')
    assert.equal(d1.imageKeyword2, null)

    assert.equal(d2.imageKeyword, 'Harbour City Hong Kong')
    assert.equal(d2.imageKeyword2, 'SoHo Hong Kong')

    assert.equal(d3.imageKeyword, 'Wong Tai Sin Temple')
    assert.equal(d3.imageKeyword2, 'Senado Square')

    assert.equal(d4.imageKeyword, 'Hong Kong')
    assert.notEqual(d4.imageKeyword, 'Victoria Peaks')
    assert.equal(d4.imageKeyword2, null)
  })

  it('routeText 없는 flight day — apply 후 kw1 빈값', () => {
    const out = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 7,
          title: '인천 국제공항 도착',
          description: '귀국 후 인천 국제공항 도착',
          routeText: null,
          imageKeyword: 'Incheon',
          imageKeyword2: null,
        },
      ],
      { productDestination: 'Europe' },
    )
    assert.equal(out[0]!.imageKeyword, '')
    assert.notEqual(out[0]!.imageKeyword, 'Incheon')
  })
})

describe('resolveYbtourPrimaryKeyword — 비행일만 routeText 강제', () => {
  it('touring 일차는 augment kw1 유지', () => {
    const kw = resolveYbtourPrimaryKeyword(
      {
        day: 2,
        imageKeyword: 'Harbour City Hong Kong',
        routeText: '홍콩 - 하버 시티',
      },
      'touring',
    )
    assert.equal(kw, 'Harbour City Hong Kong')
  })

  it('flight 일차는 Victoria Peaks → Hong Kong', () => {
    const kw = resolveYbtourPrimaryKeyword(
      {
        day: 4,
        imageKeyword: 'Victoria Peaks',
        routeText: '홍콩 - 인천',
      },
      'flight',
    )
    assert.equal(kw, 'Hong Kong')
  })

  it('routeText 없는 flight day — Incheon → 빈값', () => {
    const kw = resolveYbtourPrimaryKeyword(
      {
        day: 7,
        imageKeyword: 'Incheon',
        routeText: null,
      },
      'flight',
    )
    assert.equal(kw, '')
    assert.notEqual(kw, 'Incheon')
  })
})

describe('resolveYbtourSecondaryKeyword — dayKind 게이트', () => {
  const dest = 'Hong Kong'

  it('flight/free → null', () => {
    assert.equal(
      resolveYbtourSecondaryKeyword(
        { day: 1, imageKeyword2: 'SoHo Hong Kong', routeText: '인천 - 홍콩' },
        'Hong Kong',
        'flight',
        dest,
      ),
      null,
    )
    assert.equal(
      resolveYbtourSecondaryKeyword(
        { day: 3, imageKeyword2: 'Senado Square', routeText: '홍콩 - 자유' },
        'Wong Tai Sin Temple',
        'free',
        dest,
      ),
      null,
    )
  })

  it('touring + LLM kw2 keep', () => {
    assert.equal(
      resolveYbtourSecondaryKeyword(
        {
          day: 2,
          imageKeyword2: 'SoHo Hong Kong',
          description: '하버 시티와 소호 거리',
        },
        'Harbour City Hong Kong',
        'touring',
        dest,
      ),
      'SoHo Hong Kong',
    )
  })

  it('touring + LLM null → det 2순위 폴백', () => {
    const kw2 = resolveYbtourSecondaryKeyword(
      {
        day: 2,
        title: '홍콩 시내',
        description: 'Harbour City and SoHo district tour with Victoria Peak',
        imageKeyword2: null,
      },
      'Harbour City',
      'touring',
      dest,
    )
    assert.ok(kw2)
    assert.notEqual(kw2, 'Harbour City')
  })
})
