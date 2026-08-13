/**
 * REGRESSION-FREEZE[register-schedule-description-characteristic-ssot]
 */
import { describe, expect, it } from 'vitest'
import {
  composeRegisterScheduleCharacteristicDescription,
  countRegisterScheduleDescriptionSentences,
  registerScheduleDescriptionHasAttractionNameLeak,
} from '@/lib/register-schedule-description-characteristic-ssot'
import { composeRegisterScheduleRegionVibeDescription } from '@/lib/register-schedule-region-vibe'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'

describe('register schedule description characteristic SSOT', () => {
  it('3문장 이상 · 명소명 없음 · 일차마다 다른 결', () => {
    const d1 = composeRegisterScheduleCharacteristicDescription({
      day: 1,
      maxDay: 4,
      routePlaces: ['홍콩', '헐리우드로드', '소호거리', '빅토리아 피크트램'],
      joinedBlob: '홍콩 - 헐리우드로드 - 소호거리 - 빅토리아 피크트램',
    })
    const d2 = composeRegisterScheduleCharacteristicDescription({
      day: 2,
      maxDay: 4,
      routePlaces: ['구룡', '웡타이신사원'],
      joinedBlob: '구룡 - 웡타이신사원',
    })
    const d3 = composeRegisterScheduleCharacteristicDescription({
      day: 3,
      maxDay: 4,
      routePlaces: ['란타우섬', '홍콩 디즈니랜드'],
      joinedBlob: '란타우섬 - 홍콩 디즈니랜드',
    })
    for (const [label, desc, places] of [
      ['d1', d1, ['헐리우드로드', '소호거리', '빅토리아 피크트램']],
      ['d2', d2, ['웡타이신사원']],
      ['d3', d3, ['홍콩 디즈니랜드', '란타우섬']],
    ] as const) {
      expect(countRegisterScheduleDescriptionSentences(desc), label).toBeGreaterThanOrEqual(3)
      expect(registerScheduleDescriptionHasAttractionNameLeak(desc, places), label).toBe(false)
      expect(desc).not.toMatch(/디즈니랜드|피크트램|헐리우드로드|웡타이신|소호거리/)
      expect(desc).not.toMatch(/하루 동안 여러 장면이 자연스럽게/)
    }
    expect(d1).not.toBe(d2)
    expect(d2).not.toBe(d3)
    expect(d3).toMatch(/테마파크|놀이|파크/)
  })

  it('region vibe 경로도 3문장+ · 장가계≠대련', () => {
    const dalian = composeRegisterScheduleRegionVibeDescription({
      day: 2,
      maxDay: 5,
      routePlaces: ['대련', '동관거리'],
      joinedBlob: '대련 - 동관거리 - 연화산',
    })
    const zjj = composeRegisterScheduleRegionVibeDescription({
      day: 3,
      maxDay: 5,
      routePlaces: ['장가계', '천문산'],
      joinedBlob: '장가계 - 천문산 - 원가계',
    })
    expect(countRegisterScheduleDescriptionSentences(dalian ?? '')).toBeGreaterThanOrEqual(3)
    expect(countRegisterScheduleDescriptionSentences(zjj ?? '')).toBeGreaterThanOrEqual(3)
    expect(dalian).toMatch(/항구|해안|도심|바다/)
    expect(zjj).toMatch(/기암|협곡|풍경|시야/)
    expect(dalian).not.toBe(zjj)
    expect(registerScheduleDescriptionHasAttractionNameLeak(dalian ?? '', ['대련', '동관거리', '연화산'])).toBe(
      false,
    )
    expect(registerScheduleDescriptionHasAttractionNameLeak(zjj ?? '', ['장가계', '천문산', '원가계'])).toBe(false)
  })

  it('modetour 등록 경로 — 전 일차 3문장+ · 명소명 미언급', () => {
    const days = modetourFactDaysToRegisterSchedule([
      {
        day: 1,
        places: ['홍콩', '헐리우드로드', '소호거리', '빅토리아 피크트램 (편도)'],
        hotels: [],
        meals: [],
        transportNote: '인천 - 홍콩',
      },
      {
        day: 2,
        places: ['구룡', '웡타이신사원'],
        hotels: [],
        meals: [],
        transportNote: null,
      },
      {
        day: 3,
        places: ['란타우섬', '홍콩 디즈니랜드'],
        hotels: [],
        meals: [],
        transportNote: null,
      },
      { day: 4, places: ['인천'], hotels: [], meals: [], transportNote: null },
    ])
    expect(days).toHaveLength(4)
    for (const d of days) {
      expect(countRegisterScheduleDescriptionSentences(d.description)).toBeGreaterThanOrEqual(3)
      expect(
        registerScheduleDescriptionHasAttractionNameLeak(
          d.description,
          String(d.routeText ?? '')
            .split(/\s*-\s*/)
            .filter(Boolean),
        ),
      ).toBe(false)
    }
  })
})
