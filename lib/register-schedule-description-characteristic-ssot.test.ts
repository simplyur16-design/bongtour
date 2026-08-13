/**
 * REGRESSION-FREEZE[register-schedule-description-characteristic-ssot]
 */
import { describe, expect, it } from 'vitest'
import {
  acceptSupplierScheduleDaySummary,
  composeRegisterScheduleCharacteristicDescription,
  composeRegisterScheduleDaySummary,
  countRegisterScheduleDescriptionSentences,
  registerScheduleDescriptionHasAttractionNameLeak,
  registerScheduleDescriptionMentionsRoutePoi,
} from '@/lib/register-schedule-description-characteristic-ssot'
import { composeRegisterScheduleRegionVibeDescription } from '@/lib/register-schedule-region-vibe'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'

describe('register schedule day summary SSOT', () => {
  it('2~3문장 · route 명소 포함 · 일차마다 다른 결', () => {
    const d1 = composeRegisterScheduleDaySummary({
      day: 1,
      maxDay: 4,
      routePlaces: ['홍콩', '헐리우드로드', '소호거리', '빅토리아 피크트램'],
      joinedBlob: '인천 - 홍콩 - 헐리우드로드 - 소호거리 - 빅토리아 피크트램',
    })
    const d2 = composeRegisterScheduleDaySummary({
      day: 2,
      maxDay: 4,
      routePlaces: ['구룡', '웡타이신사원'],
      joinedBlob: '구룡 - 웡타이신사원',
    })
    const d3 = composeRegisterScheduleDaySummary({
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
      const n = countRegisterScheduleDescriptionSentences(desc)
      expect(n, label).toBeGreaterThanOrEqual(2)
      expect(n, label).toBeLessThanOrEqual(3)
      expect(registerScheduleDescriptionMentionsRoutePoi(desc, places), label).toBe(true)
      expect(registerScheduleDescriptionHasAttractionNameLeak(desc, places), label).toBe(false)
      expect(desc).not.toMatch(/하루 동안 여러 장면이 자연스럽게/)
      expect(desc).not.toMatch(/규슈/)
    }
    expect(d1).toMatch(/헐리우드로드|소호거리|피크트램|홍콩/)
    expect(d3).toMatch(/디즈니/)
    expect(d1).not.toBe(d2)
    expect(d2).not.toBe(d3)
  })

  it('공급사 문장 우선 — 품질 통과 시 합성하지 않음', () => {
    const supplier =
      '란타우섬으로 이동합니다. 홍콩 디즈니랜드에서 종일 일정을 즐깁니다. 퍼레이드와 어트랙션을 이어서 둘러봅니다.'
    const desc = composeRegisterScheduleDaySummary({
      day: 3,
      maxDay: 4,
      routePlaces: ['란타우섬', '홍콩 디즈니랜드'],
      joinedBlob: '란타우섬 - 홍콩 디즈니랜드',
      supplierText: supplier,
    })
    expect(desc).toBe(supplier)
    expect(
      acceptSupplierScheduleDaySummary(supplier, ['란타우섬', '홍콩 디즈니랜드'], 3, 4),
    ).toBe(supplier)
    expect(
      acceptSupplierScheduleDaySummary(
        '하루 동안 여러 장면이 자연스럽게 이어지는 알찬 동선입니다. 분위기와 리듬이 중심입니다.',
        ['란타우섬', '홍콩 디즈니랜드'],
        3,
        4,
      ),
    ).toBeNull()
  })

  it('region vibe 경로도 route 명소 2~3문장 · 장가계≠대련', () => {
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
    expect(countRegisterScheduleDescriptionSentences(dalian ?? '')).toBeGreaterThanOrEqual(2)
    expect(countRegisterScheduleDescriptionSentences(zjj ?? '')).toBeGreaterThanOrEqual(2)
    expect(dalian).toMatch(/대련|동관거리/)
    expect(zjj).toMatch(/장가계|천문산/)
    expect(dalian).not.toBe(zjj)
    expect(registerScheduleDescriptionHasAttractionNameLeak(dalian ?? '', ['대련', '동관거리', '연화산'])).toBe(
      false,
    )
    expect(registerScheduleDescriptionHasAttractionNameLeak(zjj ?? '', ['장가계', '천문산', '원가계'])).toBe(false)
  })

  it('modetour 등록 경로 — 전 일차 2~3문장 · route 명소 언급', () => {
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
      const n = countRegisterScheduleDescriptionSentences(d.description)
      expect(n, `${d.day}일차`).toBeGreaterThanOrEqual(2)
      expect(n, `${d.day}일차`).toBeLessThanOrEqual(3)
      expect(d.description).not.toBe(d.routeText)
      expect(
        registerScheduleDescriptionHasAttractionNameLeak(
          d.description,
          String(d.routeText ?? '')
            .split(/\s*-\s*/)
            .filter(Boolean),
        ),
      ).toBe(false)
    }
    expect(days[2]?.description).toMatch(/디즈니/)
    expect(days[3]?.description).toMatch(/귀국/)
    expect(
      composeRegisterScheduleCharacteristicDescription({
        day: 3,
        maxDay: 4,
        routePlaces: ['란타우섬', '홍콩 디즈니랜드'],
        joinedBlob: '란타우섬 - 홍콩 디즈니랜드',
      }),
    ).toMatch(/디즈니/)
  })
})
