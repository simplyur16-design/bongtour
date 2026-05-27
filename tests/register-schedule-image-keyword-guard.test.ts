import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeScheduleWithFirstPassPreferExtractRows } from '../lib/register-schedule-extract-verygoodtour'
import { polishVerygoodRegisterScheduleImageKeywords } from '../lib/verygoodtour-schedule-image-keyword'
import { applyHanatourScheduleImageKeywordsToRows } from '../lib/hanatour-schedule-image-keyword'
import { keywordFromTitleDescription } from '../lib/parse-and-register-ybtour-schedule'
import { sanitizeVerygoodtourScheduleRowExpression } from '../lib/parse-and-register-verygoodtour-schedule'
import { buildProductScheduleJsonForDb } from '../lib/schedule-image-keyword-persist'
import type { RegisterScheduleDay } from '../lib/register-llm-schema-verygoodtour'

describe('mergeScheduleWithFirstPassPreferExtractRows fp-only', () => {
  it('imageKeyword를 trim만 하고 그대로 보존한다', () => {
    const merged = mergeScheduleWithFirstPassPreferExtractRows(
      [],
      [
        {
          day: 1,
          title: 'Osaka',
          description: 'Dotonbori',
          imageKeyword: 'Osaka Castle',
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

describe('applyHanatourScheduleImageKeywordsToRows', () => {
  it('LLM 영문 키워드를 유지하고 타대륙 환각은 제거한다', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '델리',
          description: '타지마할 관람',
          routeText: '델리 - 타지마할',
          imageKeyword: '  Taj Mahal  ',
          imageKeyword2: 'Paris Eiffel Tower',
        },
      ],
      { productDestination: 'India' },
    )
    assert.equal(out[0]!.imageKeyword, 'Taj Mahal')
    assert.equal(out[0]!.imageKeyword2, null)
  })
})

describe('buildProductScheduleJsonForDb — process-images·등록대기 SSOT', () => {
  it('입력 imageKeyword·imageKeyword2를 persist만 하고 변환하지 않는다', () => {
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
        imageKeyword2: 'Henderson Waves Bridge',
      },
    ]
    const json = buildProductScheduleJsonForDb(rows)
    const saved = JSON.parse(json) as Array<{ day: number; imageKeyword: string; imageKeyword2: string | null }>
    assert.equal(saved[0]!.imageKeyword, 'Marina Bay Sands')
    assert.equal(saved[1]!.imageKeyword, 'Gardens by the Bay')
    assert.equal(saved[1]!.imageKeyword2, 'Henderson Waves Bridge')
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
