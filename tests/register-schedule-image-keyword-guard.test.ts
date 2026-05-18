import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeScheduleWithFirstPassPreferExtractRows } from '../lib/register-schedule-extract-verygoodtour'
import { polishVerygoodRegisterScheduleImageKeywords } from '../lib/verygoodtour-schedule-image-keyword'
import { keywordFromTitleDescription } from '../lib/parse-and-register-ybtour-schedule'
import { sanitizeVerygoodtourScheduleRowExpression } from '../lib/parse-and-register-verygoodtour-schedule'
import type { RegisterScheduleDay } from '../lib/register-llm-schema-verygoodtour'

describe('mergeScheduleWithFirstPassPreferExtractRows fp-only', () => {
  it('삼단 imageKeyword를 finalize하여 장소명만 남긴다', () => {
    const merged = mergeScheduleWithFirstPassPreferExtractRows(
      [],
      [
        {
          day: 1,
          title: 'Osaka',
          description: 'Dotonbori',
          imageKeyword: 'Osaka Castle / landmark exterior / street-level view',
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
