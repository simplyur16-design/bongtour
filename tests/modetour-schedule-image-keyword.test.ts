import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyModetourScheduleImageKeywordsToRows,
  isModetourCrossContinentHallucinationKeyword,
  isModetourDomesticHubToken,
} from '../lib/modetour-schedule-image-keyword'

describe('isModetourDomesticHubToken', () => {
  it('국내 출발지 토큰을 true로', () => {
    assert.equal(isModetourDomesticHubToken('인천'), true)
    assert.equal(isModetourDomesticHubToken('대구'), true)
    assert.equal(isModetourDomesticHubToken('Da Nang'), false)
  })
})

describe('isModetourCrossContinentHallucinationKeyword', () => {
  it('베트남 목적지에서 Paris는 환각', () => {
    assert.equal(isModetourCrossContinentHallucinationKeyword('Paris', 'Vietnam'), true)
    assert.equal(isModetourCrossContinentHallucinationKeyword('Da Nang', 'Vietnam'), false)
    assert.equal(isModetourCrossContinentHallucinationKeyword('Hoi An', '다낭'), false)
  })
})

describe('applyModetourScheduleImageKeywordsToRows — LLM 2순위 + routeText 영문 폴백', () => {
  const vietnamOpts = { productDestination: 'Vietnam' }

  it('LLM Da Nang / Hoi An → 1·2순위 (finalize SSOT: Da / Hoi)', () => {
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '다낭',
          description: '다낭과 호이안 관광',
          routeText: 'Da Nang - Hoi An',
          imageKeyword: 'Da Nang',
          imageKeyword2: 'Hoi An',
        },
      ],
      vietnamOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Da')
    assert.equal(out[0]!.imageKeyword2, 'Hoi')
  })

  it('routeText Da Nang - Hoi An, LLM 없음 → routeText 1·2순위', () => {
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '다낭',
          description: '관광',
          routeText: 'Da Nang - Hoi An',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      vietnamOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Da')
    assert.equal(out[0]!.imageKeyword2, 'Hoi')
  })

  it('대구 출발 — LLM Daegu 거부, routeText 첫 영문 Da Nang', () => {
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '출발',
          description: '대구 출발',
          routeText: '대구 - Da Nang',
          imageKeyword: 'Daegu',
          imageKeyword2: null,
        },
      ],
      vietnamOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Da')
    assert.equal(out[0]!.imageKeyword2, null)
  })

  it('Vietnam + LLM Paris 환각 차단 — routeText 1순위 유지', () => {
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '다낭',
          description: '관광',
          routeText: 'Da Nang - Hoi An',
          imageKeyword: 'Paris',
          imageKeyword2: 'Hoi An',
        },
      ],
      vietnamOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Da')
    assert.equal(out[0]!.imageKeyword2, 'Hoi')
  })

  it('출발/귀국일 — 2순위 null', () => {
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '인천',
          description: '인천 ICN 출발 → 다낭 도착',
          routeText: 'Incheon - Da Nang',
          imageKeyword: 'Da Nang',
          imageKeyword2: 'Hoi An',
        },
        {
          day: 5,
          title: '귀국',
          description: '다낭 출발 인천 국제공항 도착',
          routeText: 'Da Nang - Incheon',
          imageKeyword: 'Da Nang',
          imageKeyword2: 'Hoi An',
        },
      ],
      { productDestination: '다낭, 호이안' },
    )
    assert.equal(out[0]!.imageKeyword, 'Da')
    assert.equal(out[0]!.imageKeyword2, null)
    assert.equal(out[1]!.imageKeyword2, null)
  })
})
