import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { DetailBodyParseSnapshot } from '../lib/detail-body-parser-types'
import type { RegisterScheduleDay } from '../lib/register-llm-schema-hanatour'
import { applyHanatourScheduleImageKeywordsToRows } from '../lib/hanatour-schedule-image-keyword'
import { polishHanatourScheduleRowsPreferDetailBody } from '../lib/parse-and-register-hanatour-schedule'

function mkScheduleRow(overrides: Partial<RegisterScheduleDay> = {}): RegisterScheduleDay {
  return {
    day: 4,
    title: '야리가다케',
    description: '야리가다케 등산 후 신호다카 온천',
    routeText: '야리가다케 - 신호다카 - 히라유',
    imageKeyword: 'Yarigatake',
    imageKeyword2: 'Shinhotaka Onsen',
    ...overrides,
  }
}

function mkDetailBody(scheduleText: string): DetailBodyParseSnapshot {
  return {
    normalizedRaw: scheduleText,
    sections: [{ type: 'schedule_section', text: scheduleText }],
    review: { required: [], warning: [], info: [] },
    sectionReview: {},
    flightStructured: {
      airlineName: null,
      outbound: {
        departureAirport: null,
        departureAirportCode: null,
        departureDate: null,
        departureTime: null,
        arrivalAirport: null,
        arrivalAirportCode: null,
        arrivalDate: null,
        arrivalTime: null,
        flightNo: null,
        durationText: null,
      },
      inbound: {
        departureAirport: null,
        departureAirportCode: null,
        departureDate: null,
        departureTime: null,
        arrivalAirport: null,
        arrivalAirportCode: null,
        arrivalDate: null,
        arrivalTime: null,
        flightNo: null,
        durationText: null,
      },
      rawFlightLines: [],
      reviewNeeded: false,
      reviewReasons: [],
    },
    hotelStructured: { rows: [], reviewNeeded: false, reviewReasons: [] },
    optionalToursStructured: {
      rows: [],
      optionalTourCountText: '',
      reviewNeeded: false,
      reviewReasons: [],
    },
    shoppingStructured: {
      rows: [],
      shoppingCountText: '',
      reviewNeeded: false,
      reviewReasons: [],
    },
    includedExcludedStructured: {
      includedItems: [],
      excludedItems: [],
      noteText: '',
      reviewNeeded: false,
      reviewReasons: [],
    },
    raw: {
      hotelPasteRaw: null,
      optionalToursPasteRaw: null,
      shoppingPasteRaw: null,
      flightRaw: null,
    },
  }
}

describe('polishHanatourScheduleRowsPreferDetailBody — imageKeyword2 보존', () => {
  const longDay4Body =
    '야리가다케 등산 후 신호다카 온천에서 휴식합니다. 알프스 산맥의 아름다운 풍경을 하루 종일 감상합니다.'

  it('detail body chunk>=36 — LLM imageKeyword2를 유지한다', () => {
    const row = mkScheduleRow()
    const detailBody = mkDetailBody(`4일차\n${longDay4Body}`)
    const out = polishHanatourScheduleRowsPreferDetailBody([row], detailBody)
    assert.equal(out[0]!.imageKeyword2, 'Shinhotaka Onsen')
    assert.equal(out[0]!.imageKeyword, 'Yarigatake')
  })

  it('detail body 없음(chunk<36) — LLM imageKeyword2를 유지한다', () => {
    const row = mkScheduleRow()
    const out = polishHanatourScheduleRowsPreferDetailBody([row], null)
    assert.equal(out[0]!.imageKeyword2, 'Shinhotaka Onsen')
  })

  it('polish 통과 후 applyHanatour — LLM 2순위 Shinhotaka Onsen', () => {
    const row = mkScheduleRow()
    const detailBody = mkDetailBody(`4일차\n${longDay4Body}`)
    const polished = polishHanatourScheduleRowsPreferDetailBody([row], detailBody)
    const out = applyHanatourScheduleImageKeywordsToRows(polished, { productDestination: 'Japan' })
    assert.equal(out[0]!.imageKeyword, 'Yarigatake')
    assert.equal(out[0]!.imageKeyword2, 'Shinhotaka Onsen')
  })
})
