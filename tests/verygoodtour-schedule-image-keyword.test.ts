import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyVerygoodScheduleImageKeywordsToRows,
  classifyVerygoodDayKind,
  extractVerygoodOrderedDayPoi,
  isVerygoodCrossContinentHallucinationKeyword,
  isVerygoodDomesticHubToken,
  resolveVerygoodPrimaryKeyword,
  resolveVerygoodSecondaryKeyword,
} from '../lib/verygoodtour-schedule-image-keyword'
import type { RegisterScheduleDay } from '../lib/register-llm-schema-verygoodtour'
import { extractVerygoodScheduleRowsFromPasteBody } from '../lib/verygoodtour-schedule-blocks-from-paste'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function detRow(day: number, description: string, title = ''): RegisterScheduleDay {
  return {
    day,
    title,
    description,
    imageKeyword: '',
    dateText: null,
    hotelText: null,
    breakfastText: null,
    lunchText: null,
    dinnerText: null,
    mealSummaryText: null,
  }
}

describe('isVerygoodDomesticHubToken', () => {
  it('국내 허브 토큰을 제외한다', () => {
    assert.equal(isVerygoodDomesticHubToken('인천'), true)
    assert.equal(isVerygoodDomesticHubToken('ICN'), true)
    assert.equal(isVerygoodDomesticHubToken('Warsaw'), false)
  })
})

describe('isVerygoodCrossContinentHallucinationKeyword', () => {
  it('India 목적지에서 Paris 환각을 차단한다', () => {
    assert.equal(isVerygoodCrossContinentHallucinationKeyword('Paris Eiffel Tower', 'India'), true)
    assert.equal(isVerygoodCrossContinentHallucinationKeyword('Taj Mahal', 'India'), false)
  })

  it('Poland 목적지에서 Paris는 A 한계로 미차단', () => {
    assert.equal(isVerygoodCrossContinentHallucinationKeyword('Paris', 'Poland'), false)
  })
})

describe('extractVerygoodOrderedDayPoi', () => {
  it('EPP0211 day2 — 따옴표 명소 순서', () => {
    const fixturePath = path.join(__dirname, '../tools/fixtures/verygood-epp0211-itinerary-snippet.txt')
    const fixture = fs.readFileSync(fixturePath, 'utf8')
    const extracted = extractVerygoodScheduleRowsFromPasteBody(fixture)
    const d2 = extracted.rows.find((r) => r.day === 2)!
    const pois = extractVerygoodOrderedDayPoi(d2.description, d2.title)
    assert.deepEqual(pois, ['쇼팽 공원', '퀴리 부인 생가', '인어 동상', '잠코비 광장'])
  })
})

describe('classifyVerygoodDayKind', () => {
  it('EPP0211 day1 — flight, day2 — touring', () => {
    const fixturePath = path.join(__dirname, '../tools/fixtures/verygood-epp0211-itinerary-snippet.txt')
    const fixture = fs.readFileSync(fixturePath, 'utf8')
    const extracted = extractVerygoodScheduleRowsFromPasteBody(fixture)
    const d1 = extracted.rows.find((r) => r.day === 1)!
    const d2 = extracted.rows.find((r) => r.day === 2)!
    assert.equal(classifyVerygoodDayKind(d1.description, d1.title, 1, 9), 'flight')
    assert.equal(classifyVerygoodDayKind(d2.description, d2.title, 2, 9), 'touring')
  })
})

describe('resolveVerygoodPrimaryKeyword — LLM only', () => {
  it('LLM 영문 키워드를 수용한다', () => {
    const kw = resolveVerygoodPrimaryKeyword(
      { day: 2, imageKeyword: '  Lazienki Park  ' },
      'touring',
      'Poland',
    )
    assert.equal(kw, 'Lazienki Park')
  })

  it('국내 허브 LLM 키워드는 거부한다', () => {
    assert.equal(resolveVerygoodPrimaryKeyword({ day: 1, imageKeyword: 'Incheon' }, 'flight', 'Japan'), '')
  })

  it('LLM 빈값 — det 폴백 없음', () => {
    const d1 = detRow(1, "#### 인천\nSeat Pitch\n#### 바르샤바\n도착", '인천-바르샤바')
    const out = applyVerygoodScheduleImageKeywordsToRows(
      [{ day: 1, title: d1.title, description: d1.description, imageKeyword: '', imageKeyword2: null }],
      { detRows: [d1], productDestination: 'Poland Baltic', totalDays: 1 },
    )
    assert.equal(out[0]!.imageKeyword, '')
  })
})

describe('resolveVerygoodSecondaryKeyword — LLM only', () => {
  it('touring: LLM imageKeyword2를 1순위와 다를 때 수용', () => {
    const kw2 = resolveVerygoodSecondaryKeyword(
      { day: 2, imageKeyword2: 'Sigismund Column' },
      'Lazienki Park',
      'touring',
      'Poland',
    )
    assert.equal(kw2, 'Sigismund Column')
  })

  it('free: kw2는 null', () => {
    assert.equal(
      resolveVerygoodSecondaryKeyword({ day: 2, imageKeyword2: 'Warsaw' }, 'Warsaw', 'free', 'Poland'),
      null,
    )
  })

  it('India + Paris imageKeyword2 → null', () => {
    assert.equal(
      resolveVerygoodSecondaryKeyword(
        { day: 2, imageKeyword2: 'Paris Eiffel Tower' },
        'Taj Mahal',
        'touring',
        'India',
      ),
      null,
    )
  })
})

describe('applyVerygoodScheduleImageKeywordsToRows — Plan A', () => {
  it('flight + LLM Warsaw → kw1=Warsaw, Seat Pitch 없음', () => {
    const fixturePath = path.join(__dirname, '../tools/fixtures/verygood-epp0211-itinerary-snippet.txt')
    const fixture = fs.readFileSync(fixturePath, 'utf8')
    const extracted = extractVerygoodScheduleRowsFromPasteBody(fixture)
    const d1 = extracted.rows.find((r) => r.day === 1)!
    const out = applyVerygoodScheduleImageKeywordsToRows(
      [{ day: 1, title: d1.title, description: d1.description, imageKeyword: 'Warsaw', imageKeyword2: null }],
      { detRows: [d1], productDestination: 'Poland Baltic', totalDays: 9 },
    )
    assert.equal(out[0]!.imageKeyword, 'Warsaw')
    assert.notEqual(out[0]!.imageKeyword, 'Seat Pitch')
  })

  it('touring + LLM 1·2순위 keep, 1≠2', () => {
    const out = applyVerygoodScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '바르샤바',
          description: "'쇼팽 공원'",
          imageKeyword: 'Lazienki Park',
          imageKeyword2: 'Sigismund Column',
        },
      ],
      { productDestination: 'Poland', totalDays: 1 },
    )
    assert.equal(out[0]!.imageKeyword, 'Lazienki Park')
    assert.equal(out[0]!.imageKeyword2, 'Sigismund Column')
  })

  it('free + LLM Warsaw → kw1=Warsaw, kw2=null', () => {
    const out = applyVerygoodScheduleImageKeywordsToRows(
      [{ day: 3, title: '바르샤바', description: '자유시간', imageKeyword: 'Warsaw', imageKeyword2: 'Dotonbori' }],
      { productDestination: 'Poland', totalDays: 3 },
    )
    assert.equal(out[0]!.imageKeyword, 'Warsaw')
    assert.equal(out[0]!.imageKeyword2, null)
  })
})
