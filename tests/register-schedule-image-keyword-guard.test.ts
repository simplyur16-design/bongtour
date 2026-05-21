import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeScheduleWithFirstPassPreferExtractRows } from '../lib/register-schedule-extract-verygoodtour'
import { polishVerygoodRegisterScheduleImageKeywords } from '../lib/verygoodtour-schedule-image-keyword'
import { keywordFromTitleDescription } from '../lib/parse-and-register-ybtour-schedule'
import { sanitizeVerygoodtourScheduleRowExpression } from '../lib/parse-and-register-verygoodtour-schedule'
import { buildDualScheduleImageKeywords } from '../lib/schedule-dual-image-keyword'
import { buildScheduleImageKeywordPlan } from '../lib/register-schedule-image-keyword-ssot'
import { isBareCityOrCountryKeyword } from '../lib/pexels-place-name-keyword'
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
