/**
 * REGRESSION-FREEZE[modetour-register-api-schedule]
 */
import { describe, expect, it } from 'vitest'
import {
  composeModetourScheduleVibeDescription,
  modetourFactDaysToRegisterSchedule,
  selectModetourScheduleHighlights,
} from '@/lib/modetour-register-api-schedule'

describe('modetour register api schedule', () => {
  it('몰디브 — 준비사항은 title/description에 넣지 않고 휴양·이동 흐름으로', () => {
    const days = modetourFactDaysToRegisterSchedule(
      [
        {
          day: 1,
          places: ['인천', '몰디브 출발 전 준비사항'],
          hotels: ['해당 일의 숙박은 기내박 입니다. 변동이 있을 경우 홈페이지'],
          meals: [],
          transportNote: '인천 국제공항 출발',
        },
        {
          day: 2,
          places: ['몰디브', '스피드 보트 이동'],
          hotels: ['총 1개의 예정 호텔이 있습니다. 확정 되는대로'],
          meals: [],
          transportNote: null,
        },
        {
          day: 3,
          places: ['몰디브'],
          hotels: ['총 1개의 예정 호텔이 있습니다.'],
          meals: [],
          transportNote: null,
        },
      ],
      { productTitle: '[가족여행] 몰디브 조이아일랜드 비치빌라 4박7일 <AI/스피드보트>' },
    )
    expect(days[0]?.title).toMatch(/인천/)
    expect(days[0]?.title).not.toMatch(/준비사항|수하물/)
    expect(days[0]?.description).not.toMatch(/출발 3시간|탑승권/)
    expect(days[0]?.hotelText).toBe('기내박')
    expect(days[1]?.title).toMatch(/스피드\s*보트|몰디브/)
    expect(days[1]?.description).not.toMatch(/▶|홈페이지/)
    expect(days[1]?.description).not.toBe(days[1]?.routeText)
    expect(days[1]?.description).toMatch(/몰디브|리조트|일정|이동|섬|휴양/)
    expect(days[1]?.hotelText).toMatch(/조이아|출발 전 확정/)
    expect(days[2]?.description).not.toBe(days[2]?.routeText)
    expect(days[2]?.description).toMatch(/몰디브|리조트|일정|휴양|섬/)
    expect(days[2]?.routeText).toBe('몰디브')
  })

  it('하이라이트 — 최대 7개·준비 안내 제외', () => {
    const highlights = selectModetourScheduleHighlights([
      '인천',
      '몰디브 출발 전 준비사항',
      '스피드 보트 이동',
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
    ])
    expect(highlights.length).toBeLessThanOrEqual(7)
    expect(highlights.some((h) => /준비사항/.test(h))).toBe(false)
  })

  it('vibe description — 장소 나열 대신 2문장 이내', () => {
    const desc = composeModetourScheduleVibeDescription(
      { day: 2, places: ['몰디브'], hotels: [], meals: [], transportNote: '스피드 보트' },
      7,
      ['몰디브', '스피드 보트 이동'],
    )
    expect(desc.split(/[.!?]/).filter((s) => s.trim().length > 8).length).toBeLessThanOrEqual(3)
    expect(desc).not.toMatch(/▶/)
  })

  it('resort_leisure vibe — 몰디브 지명 하드코딩 없음', () => {
    const desc = composeModetourScheduleVibeDescription(
      { day: 3, places: ['리조트 자유시간'], hotels: [], meals: [], transportNote: null },
      7,
      ['리조트 자유시간'],
    )
    expect(desc).toMatch(/리조트|휴양|에메랄드/)
    expect(desc).not.toMatch(/몰디브/)
  })

  it('돗토리 — 입국 안내 세그먼트는 routeText에서 제거', () => {
    const days = modetourFactDaysToRegisterSchedule([
      {
        day: 1,
        places: ['인천', '돗토리', '한국-일본 여행 입국시 관련 안내', '미즈키시게루 로드'],
        hotels: ['총 0개의 예정 호텔이 있습니다.'],
        meals: [],
        transportNote: null,
      },
    ])
    expect(days[0]?.routeText).toBe('돗토리 - 미즈키시게루 로드')
    expect(days[0]?.routeText).not.toMatch(/입국|관련\s*안내|한국-일본\s*여행/)
  })

  it('상해 1일차 — 입국신고·미팅 안내는 routeText/title에서 제거, 입국 도시는 상해만', () => {
    const days = modetourFactDaysToRegisterSchedule([
      {
        day: 1,
        places: [
          '인천',
          '중국 모바일 사전 입국신고서 등록 방법',
          '입국 도시(상해-푸동)',
          '상해 패키지 개별 일정 불가 안내 및 현지 미팅 안내',
        ],
        hotels: ['상해유적지/준4성호텔(출발 전 확정)'],
        meals: ['기내식'],
        transportNote: null,
      },
    ])
    expect(days[0]?.routeText).toBe('상해')
    expect(days[0]?.title).toBe('상해')
    expect(days[0]?.title).not.toMatch(/입국신고|미팅|개별\s*일정/)
    expect(days[0]?.description).not.toBe('상해')
    expect(days[0]?.description).toMatch(/상해|도착|일정/)
    expect(days[0]?.description).not.toMatch(/입국신고|미팅/)
  })

  // REGRESSION-FREEZE[modetour-register-api-schedule]: 괌 HTML 엔티티·<>마케팅 태그·몰디브 하드코딩 금지 — manifest
  // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: resort_leisure — 목적지명(몰디브) 하드코딩 금지 — manifest
  it('괌 — HTML 이모지 제거 · 숙소는 두짓비치 · 설명에 몰디브 금지', () => {
    const days = modetourFactDaysToRegisterSchedule(
      [
        {
          day: 1,
          places: ['&#128129;가이드: 녹색셔츠 착용 / &#128205;위치: 입국장 나와서 우측에 위치한 모두투어 데스크 앞'],
          hotels: ['총 1개의 예정 호텔이 있습니다. 확정 되는대로'],
          meals: ['진에어 기내식(출발편)'],
          transportNote: null,
        },
        {
          day: 2,
          places: ['아푸간 요새', '괌 스페인광장', '이파오비치', '돈키빌리지'],
          hotels: ['총 1개의 예정 호텔이 있습니다.'],
          meals: ['불포함'],
          transportNote: null,
        },
        {
          day: 3,
          places: ['전일 리조트 내 부대시설 이용 및 자유시간'],
          hotels: ['총 1개의 예정 호텔이 있습니다.'],
          meals: ['불포함'],
          transportNote: null,
        },
        {
          day: 4,
          places: ['숙박 없음(귀국)'],
          hotels: [],
          meals: [],
          transportNote: null,
        },
      ],
      {
        productTitle:
          '[저녁출발]괌 두짓비치 디럭스오션뷰룸 3박5일<아일랜드관광/레이트체크아웃>',
      },
    )
    expect(days[0]?.routeText ?? '').not.toMatch(/&#|128129/)
    expect(days[0]?.title ?? '').not.toMatch(/&#|128129/)
    // REGRESSION-FREEZE[modetour-register-api-schedule]: 가이드 미팅 문구 route 금지 — manifest
    expect(days[0]?.routeText ?? '').not.toMatch(/가이드|녹색셔츠|데스크/)
    expect(days[0]?.hotelText).toMatch(/두짓비치/)
    expect(days[0]?.hotelText).not.toMatch(/아일랜드관광|레이트체크아웃/)
    expect(days[1]?.description).not.toMatch(/몰디브/)
    expect(days[2]?.description).not.toMatch(/몰디브/)
    expect(days[2]?.routeText ?? '').not.toMatch(/아푸간|돈키빌리지/)
    // day2 sightseeing → generic ok; day3 free/resort — 몰디브 지명만 금지(프로필은 자유시간 문구에 따라 달라질 수 있음)
    expect(
      [days[1]?.description, days[2]?.description, days[3]?.description].join(' '),
    ).not.toMatch(/몰디브/)
  })
})
