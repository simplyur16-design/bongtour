/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot] — hanatour prebuild (dual-slot 회귀만)
 * REGRESSION-FREEZE[hanatour-schedule-image-keyword-landmark]
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyHanatourScheduleImageKeywordsToRows } from '../lib/hanatour-schedule-image-keyword'

describe('hanatour prebuild — imageKeyword dual slot', () => {
  const indiaOpts = { productDestination: 'India' }

  it('본문 타지마할·아그라 성 — kw1/kw2 (Agra LLM → Taj + Agra Fort)', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '아그라',
          description: '타지마할 외부 관람과 아그라 성 방문',
          routeText: '델리 - 아그라',
          imageKeyword: 'Agra',
          imageKeyword2: null,
        },
      ],
      indiaOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Taj Mahal')
    assert.equal(out[0]!.imageKeyword2, 'Agra Fort')
  })

  it('routeText Taj Mahal - Agra Fort — kw2 Agra Fort', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '아그라',
          description: '관광',
          routeText: 'Taj Mahal - Agra Fort',
          imageKeyword: 'Taj Mahal',
          imageKeyword2: null,
        },
      ],
      indiaOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Taj Mahal')
    assert.equal(out[0]!.imageKeyword2, 'Agra Fort')
  })

  it('출발·귀국 일차 — imageKeyword2 null', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '출발',
          description: '인천 출발 델리 도착',
          routeText: '인천 - 델리',
          imageKeyword: 'Delhi',
          imageKeyword2: 'Taj Mahal',
        },
        {
          day: 5,
          title: '귀국',
          description: '델리 출발 인천 도착',
          routeText: '델리 - 인천',
          imageKeyword: 'Delhi',
          imageKeyword2: 'Agra Fort',
        },
      ],
      indiaOpts,
    )
    assert.equal(out.find((r) => r.day === 1)!.imageKeyword2, null)
    assert.equal(out.find((r) => r.day === 5)!.imageKeyword2, null)
  })

  it('LLM imageKeyword2 유지 — 1순위와 다를 때', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 4,
          title: '야리가다케',
          description: '야리가다케와 신호다카 온천',
          routeText: 'Yarigatake - Hirayu Onsen - Shinhotaka',
          imageKeyword: 'Yarigatake',
          imageKeyword2: 'Shinhotaka Onsen',
        },
      ],
      { productDestination: 'Japan' },
    )
    assert.equal(out[0]!.imageKeyword2, 'Shinhotaka Onsen')
    assert.notEqual(out[0]!.imageKeyword, out[0]!.imageKeyword2)
  })
})
