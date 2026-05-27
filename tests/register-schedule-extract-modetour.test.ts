import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  mergeScheduleWithFirstPassPreferExtractRows,
  parseScheduleRowsFromLlmJson,
} from '../lib/register-schedule-extract-modetour'
import { applyModetourScheduleImageKeywordsToRows } from '../lib/modetour-schedule-image-keyword'

describe('parseScheduleRowsFromLlmJson — modetour imageKeyword2 보존', () => {
  it('LLM imageKeyword2를 파싱하고 apply 후 2순위에 반영', () => {
    const rows = parseScheduleRowsFromLlmJson(
      [
        {
          day: 2,
          title: '과달라하라',
          description: '대성당과 시내 관광',
          imageKeyword: 'Guadalajara Cathedral',
          imageKeyword2: 'Tequila',
          routeText: '과달라하라 - 테키라',
          hotelText: null,
          breakfastText: null,
          lunchText: null,
          dinnerText: null,
          mealSummaryText: null,
        },
      ],
      { expectedDays: 2, strictDay: null },
    )
    assert.equal(rows.length, 1)
    assert.equal(rows[0]!.imageKeyword, 'Guadalajara Cathedral')
    assert.equal(rows[0]!.imageKeyword2, 'Tequila')
  })

  it('자유시간·단일 도시 — LLM 영문 명소면 1순위 채움(한글 routeText 폴백 없음)', () => {
    const rows = parseScheduleRowsFromLlmJson(
      [
        {
          day: 4,
          title: '과달라하라 자유시간',
          description: '자유시간',
          imageKeyword: 'Guadalajara Cathedral',
          imageKeyword2: null,
          routeText: '과달라하라',
          hotelText: null,
          breakfastText: null,
          lunchText: null,
          dinnerText: null,
          mealSummaryText: null,
        },
      ],
      { expectedDays: 4, strictDay: null },
    )
    assert.equal(rows[0]!.imageKeyword, 'Guadalajara Cathedral')
    assert.equal(rows[0]!.imageKeyword2, null)
  })

  it('자유일정·명소0 — LLM 도시 영문(Guadalajara) 1순위, 2순위 null', () => {
    const rows = parseScheduleRowsFromLlmJson(
      [
        {
          day: 4,
          title: '과달라하라 자유시간',
          description: '전일 자유시간',
          imageKeyword: 'Guadalajara',
          imageKeyword2: null,
          routeText: '과달라하라',
          hotelText: null,
          breakfastText: null,
          lunchText: null,
          dinnerText: null,
          mealSummaryText: null,
        },
      ],
      { expectedDays: 4, strictDay: null },
    )
    assert.equal(rows[0]!.imageKeyword, 'Guadalajara')
    assert.equal(rows[0]!.imageKeyword2, null)
  })

  it('자유일정·본문 명소 — Day3 에스타디오 아크론 1순위', () => {
    const rows = parseScheduleRowsFromLlmJson(
      [
        {
          day: 3,
          title: '과달라하라 자유일정',
          description: '에스타디오 아크론 월드컵 경기 관람 등 자유일정',
          imageKeyword: 'Estadio Akron',
          imageKeyword2: null,
          routeText: '과달라하라 - 에스타디오 아크론',
          hotelText: null,
          breakfastText: null,
          lunchText: null,
          dinnerText: null,
          mealSummaryText: null,
        },
      ],
      { expectedDays: 3, strictDay: null },
    )
    assert.equal(rows[0]!.imageKeyword, 'Estadio Akron')
  })

  it('자유일정·본문 명소 2곳 — Day5 데낄라공장/테킬라마을 1·2순위', () => {
    const rows = parseScheduleRowsFromLlmJson(
      [
        {
          day: 5,
          title: '테킬라 자유일정',
          description: '데낄라 공장 견학 및 테킬라 마을 투어',
          imageKeyword: 'Tequila',
          imageKeyword2: 'La Rojena',
          routeText: '테킬라 - 데낄라 공장 - 테킬라 마을',
          hotelText: null,
          breakfastText: null,
          lunchText: null,
          dinnerText: null,
          mealSummaryText: null,
        },
      ],
      { expectedDays: 5, strictDay: null },
    )
    assert.equal(rows[0]!.imageKeyword, 'Tequila')
    assert.equal(rows[0]!.imageKeyword2, 'La Rojena')
  })

  it('LLM imageKeyword 없고 한글 routeText만 — 1순위 빈값 유지', () => {
    const rows = parseScheduleRowsFromLlmJson(
      [
        {
          day: 4,
          title: '과달라하라 자유시간',
          description: '자유시간',
          imageKeyword: '',
          imageKeyword2: null,
          routeText: '과달라하라',
          hotelText: null,
          breakfastText: null,
          lunchText: null,
          dinnerText: null,
          mealSummaryText: null,
        },
      ],
      { expectedDays: 4, strictDay: null },
    )
    assert.equal(rows[0]!.imageKeyword, '')
    assert.equal(rows[0]!.imageKeyword2, null)
  })
})

describe('mergeScheduleWithFirstPassPreferExtractRows — modetour imageKeyword2', () => {
  it('fp·main 병합 시 fp.imageKeyword2 우선', () => {
    const merged = mergeScheduleWithFirstPassPreferExtractRows(
      [{ day: 2, title: 't', description: 'd', imageKeyword: 'A', imageKeyword2: 'MainSecond' }],
      [
        {
          day: 2,
          title: 'Guadalajara',
          description: '관광',
          imageKeyword: 'Guadalajara Cathedral',
          imageKeyword2: 'Tequila',
          routeText: '과달라하라 - 테키라',
          hotelText: null,
          breakfastText: null,
          lunchText: null,
          dinnerText: null,
          mealSummaryText: null,
        },
      ],
      2,
    )
    assert.ok(merged)
    const row = merged[0] as { imageKeyword2: string | null }
    assert.equal(row.imageKeyword2, 'Tequila')
  })

  it('fp-only 일차에 imageKeyword2 보존', () => {
    const merged = mergeScheduleWithFirstPassPreferExtractRows(
      [],
      [
        {
          day: 1,
          title: 'Guadalajara',
          description: '관광',
          imageKeyword: 'Guadalajara Cathedral',
          imageKeyword2: 'Estadio Akron',
          routeText: '과달라하라 - 에스타디오',
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
    assert.equal((merged[0] as { imageKeyword2: string | null }).imageKeyword2, 'Estadio Akron')
  })
})

describe('미리보기 2순위 시뮬 — scheduleRowsForKw → applyModetour', () => {
  it('선추출 row에 imageKeyword2 있으면 2순위 채움', () => {
    const scheduleRowsForKw = [
      {
        day: 2,
        title: 'Guadalajara',
        description: '관광',
        routeText: '과달라하라 - 테키라',
        imageKeyword: 'Guadalajara Cathedral',
        imageKeyword2: 'Tequila' as string | null,
      },
    ]
    const out = applyModetourScheduleImageKeywordsToRows(scheduleRowsForKw, {
      productDestination: 'Mexico',
    })
    assert.equal(out[0]!.imageKeyword, 'Guadalajara Cathedral')
    assert.equal(out[0]!.imageKeyword2, 'Tequila')
  })
})
