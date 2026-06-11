/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot] — modetour prebuild
 * REGRESSION-FREEZE[modetour-schedule-image-keyword-ko-route]
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyModetourScheduleImageKeywordsToRows,
  classifyModetourScheduleCardDayKind,
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

  it('LLM Ba Na Hills가 모든 일차에 반복되면 routeText 일차별 명소 우선', () => {
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '다낭',
          description: '미케 비치',
          routeText: 'Da Nang - My Khe Beach',
          imageKeyword: 'Ba Na Hills',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '바나힐',
          description: '바나힐',
          routeText: 'Da Nang - Ba Na Hills',
          imageKeyword: 'Ba Na Hills',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '호이안',
          description: '호이안 올드타운',
          routeText: 'Da Nang - Hoi An Ancient Town',
          imageKeyword: 'Ba Na Hills',
          imageKeyword2: null,
        },
      ],
      { productDestination: '다낭' },
    )
    assert.match(out[0]!.imageKeyword!, /My Khe/i)
    assert.equal(out[1]!.imageKeyword, 'Ba Na Hills')
    assert.match(out[2]!.imageKeyword!, /Hoi/i)
    assert.ok(out[0]!.imageKeyword2?.trim(), `day2 kw2: ${out[0]!.imageKeyword2}`)
    assert.ok(out[2]!.imageKeyword2?.trim(), `day4 kw2: ${out[2]!.imageKeyword2}`)
    assert.notEqual(
      normLoose(out[0]!.imageKeyword!),
      normLoose(out[0]!.imageKeyword2!),
    )
  })
})

describe('classifyModetourScheduleCardDayKind — 인천 귀국', () => {
  it('마지막 일차 인천 국제공항 도착 → return_home', () => {
    assert.equal(
      classifyModetourScheduleCardDayKind(
        9,
        9,
        '인천 국제공항 도착\n이동 경로: 인천',
      ),
      'return_home',
    )
  })
})

describe('applyModetourScheduleImageKeywordsToRows — 라다크·인도 한글 routeText', () => {
  const indiaOpts = { productDestination: '인도, 라다크' }

  const ladakhRows = [
    {
      day: 1,
      title: '인천 출발 및 델리 도착',
      description: '',
      routeText: '인천 - 델리',
      imageKeyword: 'Delhi',
      imageKeyword2: null,
    },
    {
      day: 2,
      title: '레 도착 및 시내 관광',
      description: '',
      routeText: '델리 - 레 - 레 왕궁 - 레 시장',
      imageKeyword: 'Delhi',
      imageKeyword2: 'Leh Market',
    },
    {
      day: 7,
      title: '델리 귀환 및 시내 관광',
      description: '',
      routeText: '레 - 델리 - 아그라센 키 바올리 - 구르드와라 방글라 사힙 - 인디아 게이트(차창)',
      imageKeyword: 'Delhi',
      imageKeyword2: 'Gurudwara Bangla Sahib',
    },
    {
      day: 8,
      title: '델리 유적 관람 및 출국',
      description: '',
      routeText: '델리 - 꾸뜹미나르 - 델리 공항',
      imageKeyword: 'Delhi',
      imageKeyword2: null,
    },
    {
      day: 9,
      title: '인천 국제공항 도착',
      description: '',
      routeText: '인천',
      imageKeyword: 'Delhi',
      imageKeyword2: null,
    },
  ]

  it('Day2 — Delhi LLM 대신 routeText 레 구간 랜드마크', () => {
    const out = applyModetourScheduleImageKeywordsToRows(ladakhRows, indiaOpts)
    const d2 = out.find((r) => r.day === 2)!
    assert.match(d2.imageKeyword!, /Leh/i)
    assert.notEqual(normLoose(d2.imageKeyword!), 'delhi')
    assert.match(d2.imageKeyword2!, /Leh Market/i)
  })

  it('Day7·8 — 도시명 Delhi 대신 routeText 명소', () => {
    const out = applyModetourScheduleImageKeywordsToRows(ladakhRows, indiaOpts)
    const d7 = out.find((r) => r.day === 7)!
    const d8 = out.find((r) => r.day === 8)!
    assert.match(d7.imageKeyword!, /Agrasen|India Gate/i)
    assert.match(d8.imageKeyword!, /Qutub/i)
  })

  it('Day9 귀국 — 인천만 있으면 키워드 비움', () => {
    const out = applyModetourScheduleImageKeywordsToRows(ladakhRows, indiaOpts)
    const d9 = out.find((r) => r.day === 9)!
    assert.equal(d9.imageKeyword, '')
    assert.equal(d9.imageKeyword2, null)
  })

  it('한글 routeText만 — 알치·판공초 1·2순위', () => {
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 3,
          title: '알치와 라마유르 탐방',
          routeText: '레 - 알치 - 알치 곰파 - 라마유르 - 라마유르 곰파 - 레',
          imageKeyword: 'Alchi Monastery',
          imageKeyword2: 'Lamayuru Monastery',
        },
        {
          day: 5,
          title: '판공초',
          routeText: '누브라 밸리 - 판공초 - 메락 마을',
          imageKeyword: 'Pangong Tso',
          imageKeyword2: 'Merak Village',
        },
      ],
      indiaOpts,
    )
    assert.match(out[0]!.imageKeyword!, /Alchi/i)
    assert.match(out[0]!.imageKeyword2!, /Lamayuru/i)
    assert.match(out[1]!.imageKeyword!, /Pangong/i)
    assert.match(out[1]!.imageKeyword2!, /Merak/i)
  })
})

function normLoose(s: string): string {
  return s.trim().toLowerCase()
}
