import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyHanatourScheduleImageKeywordsToRows,
  isHanatourCrossContinentHallucinationKeyword,
  isHanatourDomesticHubToken,
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

describe('isHanatourCrossContinentHallucinationKeyword', () => {
  it('인도 목적지에서 Paris/Eiffel/Forbidden City는 환각', () => {
    assert.equal(isHanatourCrossContinentHallucinationKeyword('Paris', 'India'), true)
    assert.equal(isHanatourCrossContinentHallucinationKeyword('Paris Eiffel Tower', '인도'), true)
    assert.equal(isHanatourCrossContinentHallucinationKeyword('Forbidden City', 'India'), true)
  })

  it('인도·일본 목적지에서 Taj Mahal/Fukuoka/Nagoya/Takayama는 환각 아님', () => {
    assert.equal(isHanatourCrossContinentHallucinationKeyword('Taj Mahal', 'India'), false)
    assert.equal(isHanatourCrossContinentHallucinationKeyword('Delhi', 'India'), false)
    assert.equal(isHanatourCrossContinentHallucinationKeyword('Fukuoka', 'Japan'), false)
    assert.equal(isHanatourCrossContinentHallucinationKeyword('Nagoya', '일본'), false)
    assert.equal(isHanatourCrossContinentHallucinationKeyword('Takayama', 'Japan'), false)
    assert.equal(isHanatourCrossContinentHallucinationKeyword('Yarigatake', 'Japan'), false)
  })
})

describe('applyHanatourScheduleImageKeywordsToRows — LLM 1순위 + routeText 2순위', () => {
  const japanOpts = { productDestination: 'Japan' }
  const indiaOpts = { productDestination: 'India' }

  it('routeText 영문 둘째 세그먼트 → 2순위 그대로 (야리가다케 - 신호다카 - 히라유)', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 4,
          title: '야리가다케',
          description: '야리가다케와 신호다카 온천 관광',
          routeText: 'Yarigatake - Shinhotaka Onsen - Hirayu',
          imageKeyword: 'Yarigatake',
          imageKeyword2: null,
        },
      ],
      japanOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Yarigatake')
    assert.equal(out[0]!.imageKeyword2, 'Shinhotaka Onsen')
  })

  it('routeText 한글 둘째 세그먼트 — LLM imageKeyword2 보조(신호다카 → Shinhotaka)', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 4,
          title: '야리가다케',
          description: '야리가다케 등산 후 신호다카 온천',
          routeText: '야리가다케 - 신호다카 - 히라유',
          imageKeyword: 'Yarigatake',
          imageKeyword2: 'Shinhotaka',
        },
      ],
      japanOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Yarigatake')
    assert.equal(out[0]!.imageKeyword2, 'Shinhotaka')
  })

  it('routeText 타지마할 - 아그라성 영문 → 2순위 Agra Fort', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '아그라',
          description: '타지마할과 아그라 성 관람',
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

  it('1순위 LLM Takayama — 매핑 없이 통과', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 3,
          title: '다카야마',
          description: '다카야마 시내와 산책',
          routeText: '다카야마 - 야리가다케',
          imageKeyword: 'Takayama',
          imageKeyword2: null,
        },
      ],
      japanOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Takayama')
    assert.equal(out[0]!.imageKeyword2, null)
  })

  it('규슈 LLM Fukuoka — 그대로 통과', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '후쿠오카',
          description: '후쿠오카 시내와 근교 관광',
          routeText: '후쿠오카 - 유후인',
          imageKeyword: 'Fukuoka',
          imageKeyword2: 'Yufuin',
        },
      ],
      japanOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Fukuoka')
    assert.equal(out[0]!.imageKeyword2, 'Yufuin')
  })

  it('나고야 LLM Nagoya — 그대로 통과', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '나고야',
          description: '나고야 시내 관광 후 다카야마 이동',
          routeText: '나고야 - 다카야마',
          imageKeyword: 'Nagoya',
          imageKeyword2: null,
        },
      ],
      japanOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Nagoya')
  })

  it('카미코치 LLM Kamikochi — 매핑 없이 그대로 통과', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 5,
          title: '카미코치',
          description: '카미코치 계곡 트레킹',
          routeText: '마츠모토 - 카미코치',
          imageKeyword: 'Kamikochi',
          imageKeyword2: null,
        },
      ],
      japanOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Kamikochi')
  })

  it('routeText 둘째 명소 없으면 null — LLM imageKeyword2만으로는 채우지 않음', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '후쿠오카',
          description: '후쿠오카 시내',
          routeText: '후쿠오카',
          imageKeyword: 'Fukuoka',
          imageKeyword2: 'Dazaifu Tenmangu',
        },
      ],
      japanOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Fukuoka')
    assert.equal(out[0]!.imageKeyword2, null)
  })

  it('2순위 routeText/LLM 환각(파리/자금성) 차단 — 1순위는 유지', () => {
    const fromRoute = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '델리',
          description: '타지마할 관람',
          routeText: 'Taj Mahal - Forbidden City',
          imageKeyword: 'Taj Mahal',
          imageKeyword2: null,
        },
      ],
      indiaOpts,
    )
    assert.equal(fromRoute[0]!.imageKeyword, 'Taj Mahal')
    assert.equal(fromRoute[0]!.imageKeyword2, null)

    const fromLlm = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '델리',
          description: '타지마할과 후마운의 Tomb',
          routeText: '델리 - 타지마할',
          imageKeyword: 'Taj Mahal',
          imageKeyword2: 'Paris Eiffel Tower',
        },
      ],
      indiaOpts,
    )
    assert.equal(fromLlm[0]!.imageKeyword, 'Taj Mahal')
    assert.equal(fromLlm[0]!.imageKeyword2, null)
  })

  it('2순위가 1순위와 중복이면 null', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '후쿠오카',
          description: '후쿠오카 시내',
          routeText: 'Fukuoka - Fukuoka',
          imageKeyword: 'Fukuoka',
          imageKeyword2: 'Fukuoka',
        },
      ],
      japanOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Fukuoka')
    assert.equal(out[0]!.imageKeyword2, null)
  })

  it('인도 LLM Paris 환각 — 블랙리스트 차단, 매핑 폴백 없음', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '인천 출발',
          description: '인천국제공항 출발 후 델리 국제공항 도착',
          routeText: '인천 - 델리',
          imageKeyword: 'Paris',
          imageKeyword2: null,
        },
      ],
      indiaOpts,
    )
    assert.equal(out[0]!.imageKeyword, '')
    assert.notEqual(out[0]!.imageKeyword, 'Paris')
    assert.notEqual(out[0]!.imageKeyword, 'Delhi')
  })
})

describe('applyHanatourScheduleImageKeywordsToRows — 인도 일정', () => {
  const indiaOpts = { productDestination: 'India' }

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
      description: '타지마할 외부 관람과 아그라 성 방문',
      routeText: 'Taj Mahal - Agra Fort',
      imageKeyword: 'Taj Mahal',
      imageKeyword2: null,
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

  it('환각(파리/자금성) 차단·routeText 2순위·인천 키워드 없음', () => {
    const out = applyHanatourScheduleImageKeywordsToRows(indiaRows, indiaOpts)
    const d1 = out.find((r) => r.day === 1)!
    const d2 = out.find((r) => r.day === 2)!
    const d5 = out.find((r) => r.day === 5)!

    assert.equal(d1.imageKeyword, '')
    assert.notEqual(d1.imageKeyword, 'Paris')
    assert.equal(d1.imageKeyword2, null)

    assert.equal(d2.imageKeyword, 'Taj Mahal')
    assert.equal(d2.imageKeyword2, 'Agra Fort')

    assert.equal(d5.imageKeyword, 'Delhi')
    assert.notEqual(d5.imageKeyword, 'Incheon')
    assert.equal(d5.imageKeyword2, null)
  })
})

describe('applyHanatourScheduleImageKeywordsToRows — 부산 출발', () => {
  it('Busan LLM은 국내허브로 거부, routeText 영문 없으면 빈값', () => {
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
    assert.equal(out[0]!.imageKeyword, '')
    assert.notEqual(out[0]!.imageKeyword, 'Busan')
  })

  it('routeText에 영문 도시가 있으면 출발일 폴백으로 사용', () => {
    const out = applyHanatourScheduleImageKeywordsToRows([
      {
        day: 1,
        title: '인천 출발',
        description: '인천 출발 후 Fukuoka 도착',
        routeText: 'Incheon - Fukuoka',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ])
    assert.equal(out[0]!.imageKeyword, 'Fukuoka')
    assert.equal(out[0]!.imageKeyword2, null)
  })
})
