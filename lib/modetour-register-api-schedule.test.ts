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
    expect(days[1]?.description).toBe(days[1]?.routeText)
    expect(days[1]?.hotelText).toMatch(/조이아|출발 전 확정/)
    expect(days[2]?.description).toBe('몰디브')
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
    expect(days[0]?.routeText).toBe('인천 - 돗토리 - 미즈키시게루 로드')
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
    expect(days[0]?.routeText).toBe('인천 - 상해')
    expect(days[0]?.title).toBe('인천 - 상해')
    expect(days[0]?.title).not.toMatch(/입국신고|미팅|개별\s*일정/)
    expect(days[0]?.description).toBe('인천 - 상해')
    expect(days[0]?.description).not.toMatch(/입국신고|미팅/)
  })
})
