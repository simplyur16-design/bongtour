import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeScheduleWithFirstPassPreferExtractRows } from '../lib/register-schedule-extract-verygoodtour'
import { polishVerygoodRegisterScheduleImageKeywords } from '../lib/verygoodtour-schedule-image-keyword'
import { keywordFromTitleDescription } from '../lib/parse-and-register-ybtour-schedule'
import { sanitizeVerygoodtourScheduleRowExpression } from '../lib/parse-and-register-verygoodtour-schedule'
import { buildDualScheduleImageKeywords } from '../lib/schedule-dual-image-keyword'
import { buildScheduleImageKeywordPlan } from '../lib/register-schedule-image-keyword-ssot'
import { isBareCityOrCountryKeyword } from '../lib/pexels-place-name-keyword'
import { buildProductScheduleJsonForDb } from '../lib/schedule-image-keyword-persist'
import type { RegisterScheduleDay } from '../lib/register-llm-schema-verygoodtour'

describe('mergeScheduleWithFirstPassPreferExtractRows fp-only', () => {
  it('정규화된 imageKeyword를 그대로 보존한다 (1차 finalize는 applyScheduleImageKeywordsToRows에서 책임)', () => {
    const merged = mergeScheduleWithFirstPassPreferExtractRows(
      [],
      [
        {
          day: 1,
          title: 'Osaka',
          description: 'Dotonbori',
          imageKeyword: 'Osaka Castle', // 1차 finalize 거친 형태
          hotelText: null,
          breakfastText: null,
          lunchText: null,
          dinnerText: null,
          mealSummaryText: null,
        },
      ],
      1,
    )
    assert.ok(merged)
    assert.equal((merged[0] as { imageKeyword: string }).imageKeyword, 'Osaka Castle')
  })
})

describe('polishVerygoodRegisterScheduleImageKeywords', () => {
  it('polish 후 삼단·보조어 없이 장소명만', () => {
    const schedule: RegisterScheduleDay[] = [
      {
        day: 1,
        title: 'Bergen',
        description: 'Bryggen wharf',
        imageKeyword: 'Bergen Bryggen / landmark exterior / street-level view',
      },
    ]
    const out = polishVerygoodRegisterScheduleImageKeywords(schedule, schedule)
    assert.equal(out[0]!.imageKeyword, 'Bergen Bryggen')
  })
})

describe('keywordFromTitleDescription (ybtour)', () => {
  it('삼단 입력을 정규화한다', () => {
    const kw = keywordFromTitleDescription(
      'Osaka Castle',
      'Osaka Castle / landmark exterior / street-level view',
    )
    assert.equal(kw, 'Osaka Castle')
  })
})

describe('buildDualScheduleImageKeywords — 관광 일차 명소', () => {
  it('Shanghai 단독 LLM 키워드를 본문 기반 명소로 바꾼다', () => {
    const rows = [
      {
        day: 3,
        title: '상해 시티투어',
        description: '상해의 과거와 현재를 잇는 시티 투어 — 유원·외탄 관람',
        imageKeyword: 'Shanghai',
        imageKeyword2: 'Forbidden City',
      },
    ]
    const plan = buildScheduleImageKeywordPlan(rows)
    const dual = buildDualScheduleImageKeywords(rows[0]!, plan)
    assert.ok(!isBareCityOrCountryKeyword(dual.imageKeyword))
    assert.equal(dual.imageKeyword, 'Yu Garden')
    assert.notEqual(dual.imageKeyword2, 'Forbidden City')
    assert.ok(!isBareCityOrCountryKeyword(dual.imageKeyword2))
  })

  it('유원·외탄 일차 2순위는 The Bund 등 다른 명소', () => {
    const rows = [
      {
        day: 3,
        title: '상해',
        description: '유원·외탄 관람 후 자유시간',
        imageKeyword: 'Shanghai',
        imageKeyword2: 'Shanghai',
      },
    ]
    const plan = buildScheduleImageKeywordPlan(rows)
    const dual = buildDualScheduleImageKeywords(rows[0]!, plan)
    assert.equal(dual.imageKeyword, 'Yu Garden')
    assert.equal(dual.imageKeyword2, 'The Bund')
    assert.ok(!isBareCityOrCountryKeyword(dual.imageKeyword2))
  })

  it('귀국 일차 2순위에 도시명 중복(Shanghai/Shanghai)을 넣지 않는다', () => {
    const rows = [
      { day: 1, title: '인천 출발', description: '인천국제공항 출발 · 상해 도착', imageKeyword: '', imageKeyword2: null },
      { day: 4, title: '귀국', description: '상해 출발 및 인천 귀국', imageKeyword: 'Shanghai', imageKeyword2: 'Shanghai' },
    ]
    const plan = buildScheduleImageKeywordPlan(rows)
    const dual = buildDualScheduleImageKeywords(rows[1]!, plan)
    assert.equal(dual.imageKeyword, 'Shanghai')
    assert.notEqual(dual.imageKeyword2, 'Shanghai')
  })

  it('홍콩 routeText 순서로 1·2순위 명소를 고르고 Forbidden City·Victoria Peak 반복을 막는다', () => {
    const rows = [
      {
        day: 2,
        title: '홍콩 시내',
        description: '홍콩 시내 핵심 관광',
        routeText: '홍콩 - 하버 시티 - 소호 거리 - 타이쿤 - 빅토리아 피크',
        imageKeyword: 'Victoria Peak',
        imageKeyword2: 'Forbidden City',
      },
    ]
    const plan = buildScheduleImageKeywordPlan(rows)
    const dual = buildDualScheduleImageKeywords(rows[0]!, plan)
    assert.equal(dual.imageKeyword, 'Harbour City Hong Kong')
    assert.equal(dual.imageKeyword2, 'SoHo Hong Kong')
    assert.notEqual(dual.imageKeyword2, 'Forbidden City')
    assert.notEqual(dual.imageKeyword, 'Victoria Peak')
  })

  it('항주 일차는 West Lake·Songcheng 계열로', () => {
    const rows = [
      {
        day: 2,
        title: '항주',
        description: '항주의 역사와 화려한 송성가무쇼 관람',
        imageKeyword: 'Chenghuang',
        imageKeyword2: 'Forbidden City',
      },
    ]
    const plan = buildScheduleImageKeywordPlan(rows)
    const dual = buildDualScheduleImageKeywords(rows[0]!, plan)
    assert.equal(dual.imageKeyword, 'West Lake')
    assert.notEqual(dual.imageKeyword2, 'Forbidden City')
    assert.ok(dual.imageKeyword2 === 'Songcheng Park' || dual.imageKeyword2.length > 0)
  })
})

describe('buildDualScheduleImageKeywords — 싱가포르', () => {
  const sgRows = [
    {
      day: 1,
      title: '출발',
      description: '인천 출발 및 싱가포르 도착',
      imageKeyword: 'Mercure Singapore on Stevens',
      imageKeyword2: 'Singapore',
    },
    {
      day: 2,
      title: '시내',
      description: '싱가포르 시내 관광 및 야경 감상',
      imageKeyword: 'Henderson Waves Bridge',
      imageKeyword2: 'Forbidden City',
    },
    {
      day: 3,
      title: '자유',
      description: '싱가포르 전일 자유 일정',
      imageKeyword: 'Universal Studios',
      imageKeyword2: 'Forbidden City',
    },
    {
      day: 4,
      title: '센토사',
      description: '센토사 섬 체험 및 리버보트 탑승',
      imageKeyword: 'Merlion Park',
      imageKeyword2: 'Forbidden City',
    },
    {
      day: 5,
      title: '귀국',
      description: '인천 국제공항 도착',
      imageKeyword: 'Mercure Singapore on Stevens',
      imageKeyword2: 'Singapore',
    },
  ]
  const sgPlan = buildScheduleImageKeywordPlan(sgRows)

  it('출발·귀국 일 1순위는 호텔이 아닌 Singapore', () => {
    const d1 = buildDualScheduleImageKeywords(sgRows[0]!, sgPlan)
    assert.equal(d1.imageKeyword, 'Singapore')
    assert.notEqual(d1.imageKeyword2, 'Singapore')
    const d5 = buildDualScheduleImageKeywords(sgRows[4]!, sgPlan)
    assert.equal(d5.imageKeyword, 'Singapore')
  })

  it('관광 일 2순위에 Forbidden City·Singapore 도시명이 안 붙는다', () => {
    for (const row of sgRows.slice(1, 4)) {
      const dual = buildDualScheduleImageKeywords(row, sgPlan)
      assert.notEqual(dual.imageKeyword2, 'Forbidden City')
      assert.ok(!isBareCityOrCountryKeyword(dual.imageKeyword2) || dual.imageKeyword2 === '')
      if (dual.imageKeyword2) {
        assert.ok(dual.imageKeyword2.length > 0)
      }
    }
  })

  it('센토사 일차 2순위는 Sentosa 등 싱가포르 어트랙션', () => {
    const dual = buildDualScheduleImageKeywords(sgRows[3]!, sgPlan)
    assert.equal(dual.imageKeyword, 'Merlion Park')
    assert.ok(['Sentosa', 'Singapore River', 'Marina Bay Sands', 'Gardens by the Bay'].includes(dual.imageKeyword2))
  })
})

describe('buildProductScheduleJsonForDb — process-images·등록대기 SSOT', () => {
  it('Marina Bay Sands fallback 키워드를 본문 기반 명소로 교체하고 imageKeyword2를 포함한다', () => {
    const rows = [
      {
        day: 1,
        title: '싱가포르 도착 및 호텔 휴식',
        description:
          '인천 국제공항에서 출발하여 싱가포르 창이 국제공항에 도착합니다. 가이드와 미팅 후 호텔로 이동하여 체크인을 진행하며, 남은 시간은 자유롭게 휴식을 취합니다.',
        imageKeyword: 'Marina Bay Sands',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '싱가포르 주요 명소 및 야경 관람',
        description:
          '핸더슨 웨이브 브릿지와 하지 레인을 방문합니다. 리버원더스를 관람하고, 저녁에는 가든스 바이 더 베이에서 슈퍼트리 랩소디 쇼를 감상합니다.',
        imageKeyword: 'Gardens by the Bay',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '센토사섬 체험 및 리버보트 야경 투어',
        description: '머라이언 공원을 관광합니다. 센토사섬에서 루지와 케이블카를 체험한 뒤, 리버보트에 탑승하여 야경을 감상합니다.',
        imageKeyword: 'Merlion Park',
        imageKeyword2: null,
      },
    ]
    const json = buildProductScheduleJsonForDb(rows)
    const saved = JSON.parse(json) as Array<{ day: number; imageKeyword: string; imageKeyword2: string | null }>
    assert.equal(saved[0]!.imageKeyword, 'Singapore')
    assert.notEqual(saved[0]!.imageKeyword, 'Marina Bay Sands')
    assert.ok(['Henderson Waves Bridge', 'Gardens by the Bay'].includes(saved[1]!.imageKeyword))
    assert.ok(saved[1]!.imageKeyword2 && saved[1]!.imageKeyword2.length > 0)
    assert.equal(saved[2]!.imageKeyword, 'Merlion Park')
    assert.ok(saved[2]!.imageKeyword2)
  })
})

describe('sanitizeVerygoodtourScheduleRowExpression', () => {
  it('Day N travel placeholder는 빈 문자열로', () => {
    const row: RegisterScheduleDay = {
      day: 2,
      title: '제2일',
      description: '관광',
      imageKeyword: 'day 2 travel',
    }
    const out = sanitizeVerygoodtourScheduleRowExpression(row)
    assert.equal(out.imageKeyword, '')
  })
})
