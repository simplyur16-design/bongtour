/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot] — ybtour prebuild
 * REGRESSION-FREEZE[ybtour-schedule-image-keyword-distinct]
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyYbtourScheduleImageKeywordsToRows,
  classifyYbtourDayKind,
  classifyYbtourScheduleCardDayKind,
  isYbtourDomesticHubToken,
  pickYbtourImageKeywordsFromRouteText,
  resolveYbtourPrimaryKeyword,
  resolveYbtourSecondaryKeyword,
} from '../lib/ybtour-schedule-image-keyword'

describe('isYbtourDomesticHubToken', () => {
  it('국내 출발지 토큰을 true로', () => {
    assert.equal(isYbtourDomesticHubToken('인천'), true)
    assert.equal(isYbtourDomesticHubToken('김포'), true)
    assert.equal(isYbtourDomesticHubToken('부산'), true)
    assert.equal(isYbtourDomesticHubToken('ICN'), true)
    assert.equal(isYbtourDomesticHubToken('Hong Kong'), false)
  })
})

describe('pickYbtourImageKeywordsFromRouteText (에어텔·레거시 KO→EN)', () => {
  it('A-B-C-D에서 허브 제외 후 앞 두 곳', () => {
    assert.deepEqual(
      pickYbtourImageKeywordsFromRouteText('인천 - 두바이 - 카이로'),
      { imageKeyword: 'Dubai', imageKeyword2: 'Cairo' },
    )
    assert.deepEqual(pickYbtourImageKeywordsFromRouteText('룩소르 - 후르가다'), {
      imageKeyword: 'Luxor',
      imageKeyword2: 'Hurghada',
    })
  })
})

describe('classifyYbtourDayKind (레거시)', () => {
  it('홍콩 4일 — flight / touring / free', () => {
    assert.equal(
      classifyYbtourDayKind(
        '인천 국제공항에서 출발하여 홍콩 국제공항 도착',
        '인천 출발 및 홍콩 도착',
        '인천 - 홍콩',
        1,
        4,
      ),
      'flight',
    )
    assert.equal(
      classifyYbtourDayKind(
        '하버 시티와 소호 거리, 빅토리아 피크 관광',
        '홍콩 시내 핵심 관광',
        '홍콩 - 하버 시티 - 소호 거리 - 미드레벨 에스컬레이터 - 타이쿤 - 빅토리아 피크',
        2,
        4,
      ),
      'touring',
    )
  })
})

describe('classifyYbtourScheduleCardDayKind', () => {
  it('1일차 movement, 4일차 return_home', () => {
    assert.equal(
      classifyYbtourScheduleCardDayKind(
        1,
        4,
        '인천 출발 및 홍콩 도착\n인천 국제공항에서 출발하여 홍콩 국제공항 도착\n인천 - 홍콩',
      ),
      'movement',
    )
    assert.equal(
      classifyYbtourScheduleCardDayKind(
        4,
        4,
        '인천 국제공항 도착\n홍콩 출발 후 인천 국제공항 도착\n홍콩 - 인천',
      ),
      'return_home',
    )
  })
})

describe('applyYbtourScheduleImageKeywordsToRows — routeText 슬롯 규칙', () => {
  it('홍콩 — 1일차 목적지 1순위, 중간일 1·2순위, movement/return kw2 null', () => {
    const out = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '인천 출발 및 홍콩 도착',
          description: '인천 국제공항에서 출발하여 홍콩 국제공항 도착',
          routeText: '인천 - 홍콩',
          imageKeyword: 'Harbour City Hong Kong',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '홍콩 시내 핵심 관광',
          description: '하버 시티와 소호 거리, 빅토리아 피크 관광',
          routeText: '홍콩 - 하버 시티 - 소호 거리 - 빅토리아 피크',
          imageKeyword: 'Victoria Peak',
          imageKeyword2: 'Peak Tram',
        },
        {
          day: 4,
          title: '인천 국제공항 도착',
          description: '홍콩 출발 후 인천 국제공항 도착',
          routeText: '홍콩 - 인천',
          imageKeyword: 'Victoria Peak',
          imageKeyword2: 'Peak Tram',
        },
      ],
      { productDestination: 'Hong Kong' },
    )

    assert.equal(out.find((r) => r.day === 1)!.imageKeyword, 'Hong Kong')
    assert.equal(out.find((r) => r.day === 1)!.imageKeyword2, null)
    assert.equal(out.find((r) => r.day === 2)!.imageKeyword, 'Harbour City Hong Kong')
    assert.equal(out.find((r) => r.day === 2)!.imageKeyword2, 'SoHo Hong Kong')
    assert.equal(out.find((r) => r.day === 4)!.imageKeyword2, null)
  })

  it('이집트 — LLM 무시, routeText 순서 1·2순위', () => {
    const out = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '출발',
          description: '인천 출발',
          routeText: '인천 - 카이로',
          imageKeyword: 'Osaka Castle',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '홍해의 휴양지 후르가다로 이동',
          description: '나일강 크루즈에서 하선하여 후르가다로 이동',
          routeText: '룩소르 - 후르가다',
          imageKeyword: 'Osaka Castle',
          imageKeyword2: 'Forbidden City',
        },
        {
          day: 3,
          title: '귀국',
          description: '인천 도착',
          routeText: '카이로 - 인천',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      { productDestination: '이집트' },
    )

    assert.equal(out.find((r) => r.day === 2)!.imageKeyword, 'Luxor')
    assert.equal(out.find((r) => r.day === 2)!.imageKeyword2, 'Hurghada')
    assert.equal(out.find((r) => r.day === 3)!.imageKeyword2, null)
  })

  it('routeText 슬롯 — trip-wide 재사용 금지 (회귀)', () => {
    const norm = (s: string) => s.trim().toLowerCase()
    const out = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '출발',
          description: '인천 출발',
          routeText: '인천 - Hanoi',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '다낭',
          description: '미케 비치',
          routeText: 'Da Nang - My Khe Beach - Hoi An Ancient Town',
          imageKeyword: 'Ba Na Hills',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '귀국',
          description: '호이안 출발',
          routeText: 'Hoi An - Incheon',
          imageKeyword: 'Ba Na Hills',
          imageKeyword2: null,
        },
      ],
      { productDestination: 'Vietnam' },
    )
    const d2 = out.find((r) => r.day === 2)!
    const d3 = out.find((r) => r.day === 3)!
    assert.ok(d2.imageKeyword2?.trim(), `day2 kw2 empty: ${d2.imageKeyword2}`)
    assert.equal(norm(d2.imageKeyword!), norm('Da'))
    assert.equal(norm(d2.imageKeyword2!), norm('My Khe Beach'))
    assert.equal(norm(d3.imageKeyword!), norm('Hoi'))
    assert.equal(d3.imageKeyword2, null)
  })

  it('N일차 — 관광 routeText여도 (N-1) 미사용 1개만, kw2 null', () => {
    const out = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          routeText: '인천 - 홍콩',
          title: '출발',
          description: '',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          routeText: '홍콩 - 하버 시티 - 소호 거리 - 빅토리아 피크',
          title: '관광',
          description: '',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          routeText: '홍콩 - 인천',
          title: '귀국 전 관광',
          description: '마지막 날도 관광 동선',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      { productDestination: 'Hong Kong' },
    )
    const d3 = out.find((r) => r.day === 3)!
    assert.equal(d3.imageKeyword2, null)
    assert.equal(d3.imageKeyword, 'Victoria Peak')
  })

  it('인천 only 귀국일 — 전일 나트랑 키워드 누수 금지', () => {
    const out = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 4,
          routeText: '나트랑 - 포나가 참 사원 - 롱선사',
          title: '-',
          description: '나트랑',
          imageKeyword: 'Nha Trang',
          imageKeyword2: 'Long Son Pagoda',
        },
        {
          day: 5,
          routeText: '인천',
          title: '-',
          description: '인천',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      { productDestination: '동남아' },
    )
    assert.equal(out.find((r) => r.day === 5)!.imageKeyword?.trim() ?? '', '')
    assert.equal(out.find((r) => r.day === 5)!.imageKeyword2, null)
  })
})

describe('resolveYbtourPrimaryKeyword / resolveYbtourSecondaryKeyword (레거시 디버그)', () => {
  it('tourism — LLM 1·2순위', () => {
    const row = {
      day: 2,
      title: '홍콩',
      description: '관광',
      routeText: '홍콩 - 하버 시티 - 소호 거리',
      imageKeyword: 'Harbour City Hong Kong',
      imageKeyword2: 'SoHo Hong Kong',
    }
    assert.equal(resolveYbtourPrimaryKeyword(row, 'tourism', 'Hong Kong'), 'Harbour City Hong Kong')
    assert.equal(
      resolveYbtourSecondaryKeyword(row, 'Harbour City Hong Kong', 'tourism', 'Hong Kong'),
      'SoHo Hong Kong',
    )
  })
})

describe('applyYbtourScheduleImageKeywordsToRows — 남미 Paris 환각 차단', () => {
  it('Americas 상품 — imageKeyword2 Paris 거부', () => {
    const out = applyYbtourScheduleImageKeywordsToRows(
      [
        { day: 1, title: '출발', routeText: '인천 - 리마', imageKeyword: '', imageKeyword2: null },
        {
          day: 9,
          title: '이과수',
          routeText: '이과수 폭포 - 악마의 목구멍',
          imageKeyword: 'Iguazu Falls',
          imageKeyword2: 'Paris',
        },
        { day: 10, title: '귀국', routeText: '리우 - 인천', imageKeyword: '', imageKeyword2: null },
      ],
      { productDestination: '남미 12일' },
    )
    const d9 = out.find((r) => r.day === 9)!
    assert.match(d9.imageKeyword!, /Iguazu/i)
    assert.notEqual(String(d9.imageKeyword2 ?? '').trim().toLowerCase(), 'paris')
  })
})
