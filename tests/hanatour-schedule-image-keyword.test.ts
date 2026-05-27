import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyHanatourScheduleImageKeywordsToRows,
  isHanatourDomesticHubToken,
  isHanatourLlmImageKeywordGroundedInHaystack,
} from '../lib/hanatour-schedule-image-keyword'

describe('isHanatourDomesticHubToken', () => {
  it('국내 출발지 토큰을 true로', () => {
    assert.equal(isHanatourDomesticHubToken('인천'), true)
    assert.equal(isHanatourDomesticHubToken('부산'), true)
    assert.equal(isHanatourDomesticHubToken('대구'), true)
    assert.equal(isHanatourDomesticHubToken('청주'), true)
    assert.equal(isHanatourDomesticHubToken('ICN'), true)
    assert.equal(isHanatourDomesticHubToken('Delhi'), false)
  })
})

describe('isHanatourLlmImageKeywordGroundedInHaystack', () => {
  it('본문에 없는 파리 환각은 false', () => {
    const hay = '델리 도착 후 타지마할 관람'
    assert.equal(
      isHanatourLlmImageKeywordGroundedInHaystack('Paris Eiffel Tower', hay, ['Delhi', 'Taj Mahal']),
      false,
    )
  })

  it('본문 델리·타지마할과 대응하는 LLM은 true', () => {
    const hay = '델리 도착 후 타지마할 관람'
    assert.equal(isHanatourLlmImageKeywordGroundedInHaystack('Taj Mahal', hay, []), true)
    assert.equal(isHanatourLlmImageKeywordGroundedInHaystack('Delhi', hay, []), true)
  })

  it('한글 후쿠오카 본문 + LLM Fukuoka — mappedCandidates 없어도 grounded', () => {
    const hay = '규슈\n후쿠오카 시내 관광\n후쿠오카 타워 전망'
    assert.equal(isHanatourLlmImageKeywordGroundedInHaystack('Fukuoka', hay, []), true)
  })

  it('한글 나고야 본문 + LLM Nagoya — grounded', () => {
    const hay = '일본알프스\n나고야 - 다카야마 - 북알프스'
    assert.equal(isHanatourLlmImageKeywordGroundedInHaystack('Nagoya', hay, []), true)
  })
})

describe('applyHanatourScheduleImageKeywordsToRows — LLM 영문 키워드 보존', () => {
  it('규슈(후쿠오카 본문 + LLM Fukuoka) → imageKeyword=Fukuoka', () => {
    const out = applyHanatourScheduleImageKeywordsToRows([
      {
        day: 2,
        title: '후쿠오카',
        description: '후쿠오카 시내와 근교 관광',
        routeText: '후쿠오카 - 유후인',
        imageKeyword: 'Fukuoka',
        imageKeyword2: null,
      },
    ])
    assert.equal(out[0]!.imageKeyword, 'Fukuoka')
  })

  it('일본알프스(나고야 본문 + LLM Nagoya) → imageKeyword=Nagoya', () => {
    const out = applyHanatourScheduleImageKeywordsToRows([
      {
        day: 2,
        title: '나고야',
        description: '나고야 시내 관광 후 다카야마 이동',
        routeText: '나고야 - 다카야마',
        imageKeyword: 'Nagoya',
        imageKeyword2: null,
      },
    ])
    assert.equal(out[0]!.imageKeyword, 'Nagoya')
  })

  it('인도(델리 본문 + LLM Paris 환각) → Paris 버림, 본문 델리', () => {
    const out = applyHanatourScheduleImageKeywordsToRows([
      {
        day: 1,
        title: '인천 출발',
        description: '인천국제공항 출발 후 델리 국제공항 도착',
        routeText: '인천 - 델리',
        imageKeyword: 'Paris',
        imageKeyword2: null,
      },
    ])
    assert.equal(out[0]!.imageKeyword, 'Delhi')
    assert.notEqual(out[0]!.imageKeyword, 'Paris')
  })

  it('인도(타지마할 본문 + LLM Taj Mahal) → imageKeyword=Taj Mahal', () => {
    const out = applyHanatourScheduleImageKeywordsToRows([
      {
        day: 2,
        title: '아그라',
        description: '타지마할 외부 관람',
        routeText: '델리 - 타지마할',
        imageKeyword: 'Taj Mahal',
        imageKeyword2: null,
      },
    ])
    assert.equal(out[0]!.imageKeyword, 'Taj Mahal')
  })
})

describe('applyHanatourScheduleImageKeywordsToRows — 인도 일정', () => {
  const indiaRows = [
    {
      day: 1,
      title: '인천 출발',
      description: '인천국제공항 출발 후 델리 국제공항 도착',
      routeText: '인천 - 델리',
      imageKeyword: 'Paris Eiffel Tower',
      imageKeyword2: 'Forbidden City',
    },
    {
      day: 2,
      title: '델리 관광',
      description: '타지마할 외부 관람과 후마운의 Tomb 방문',
      routeText: '델리 - 타지마할 - 후마운의 Tomb',
      imageKeyword: 'Taj Mahal',
      imageKeyword2: "Humayun's Tomb",
    },
    {
      day: 3,
      title: '아그라',
      description: '아그라 성 관람',
      routeText: '아그라 - 아그라 성',
      imageKeyword: 'Agra Fort',
      imageKeyword2: null,
    },
    {
      day: 5,
      title: '귀국',
      description: '델리 출발 및 인천국제공항 도착',
      routeText: '델리 - 인천',
      imageKeyword: 'Delhi',
      imageKeyword2: 'Incheon',
    },
  ]

  it('day1·maxDay=해외 도시, 관광일=명소, 파리/에펠·인천 키워드 없음', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(indiaRows)
    const d1 = out.find((r) => r.day === 1)!
    const d2 = out.find((r) => r.day === 2)!
    const d5 = out.find((r) => r.day === 5)!

    assert.equal(d1.imageKeyword, 'Delhi')
    assert.notEqual(d1.imageKeyword, 'Paris')
    assert.notEqual(d1.imageKeyword, 'Incheon')
    assert.notEqual(d1.imageKeyword2, 'Paris')
    assert.notEqual(d1.imageKeyword2, 'Incheon')

    assert.equal(d2.imageKeyword, 'Taj Mahal')
    assert.ok(d2.imageKeyword2 === "Humayun's Tomb" || d2.imageKeyword2 === 'Delhi')

    assert.equal(d5.imageKeyword, 'Delhi')
    assert.notEqual(d5.imageKeyword, 'Incheon')
    assert.notEqual(d5.imageKeyword2, 'Incheon')
  })
})

describe('applyHanatourScheduleImageKeywordsToRows — 부산 출발', () => {
  it('부산은 키워드로 나오지 않음(해외 도시 매핑 없으면 빈값 허용)', () => {
    const out = applyHanatourScheduleImageKeywordsToRows([
      {
        day: 1,
        title: '부산 출발',
        description: '부산에서 출발하여 마츠야마 도착',
        routeText: '부산 - 마츠야마',
        imageKeyword: 'Busan',
        imageKeyword2: null,
      },
    ])
    assert.notEqual(out[0]!.imageKeyword, 'Busan')
    assert.notEqual(out[0]!.imageKeyword, '부산')
    assert.notEqual(out[0]!.imageKeyword, 'Incheon')
  })
})
