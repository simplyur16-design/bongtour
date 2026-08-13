/**
 * REGRESSION-FREEZE[schedule-image-seo-title-ssot]
 */
import { describe, expect, it } from 'vitest'
import {
  composeScheduleImageSeoTitleKr,
  isPollutedScheduleImageSeoTitle,
  resolveScheduleImageSeoTitleKr,
} from '@/lib/schedule-image-seo-title-ssot'
import { resolveScheduleThumbCaption } from '@/lib/schedule-image-thumb-caption'

describe('schedule image SEO title SSOT', () => {
  it('rejects library DAYN · hub airport · date move · vibe', () => {
    expect(isPollutedScheduleImageSeoTitle('라오스(비엔티엔) · DAY5')).toBe(true)
    expect(isPollutedScheduleImageSeoTitle('DAY3')).toBe(true)
    expect(isPollutedScheduleImageSeoTitle('Incheon')).toBe(true)
    expect(isPollutedScheduleImageSeoTitle('ICN')).toBe(true)
    expect(isPollutedScheduleImageSeoTitle('2026-07-10 · 출발 이동')).toBe(true)
    expect(isPollutedScheduleImageSeoTitle('하루 동안 여러 장면이 자연스럽게 이어지는, 보기와 걷기가 균형 잡힌 알찬 동선입니다.')).toBe(
      true,
    )
    expect(isPollutedScheduleImageSeoTitle('Universal Studios Singapore')).toBe(true)
    expect(isPollutedScheduleImageSeoTitle('객실내 미니바')).toBe(true)
    expect(isPollutedScheduleImageSeoTitle('상품코드: AHP406KEDT')).toBe(true)
    expect(isPollutedScheduleImageSeoTitle('홍콩 디즈니랜드')).toBe(false)
  })

  it('composes from day routeText, not foreign pool label', () => {
    const d1 = composeScheduleImageSeoTitleKr({
      day: 1,
      maxDay: 4,
      routeText: '홍콩 - 헐리우드로드 - 소호거리 - 빅토리아 피크트램 (편도)',
      destination: '홍콩',
    })
    const d3 = composeScheduleImageSeoTitleKr({
      day: 3,
      maxDay: 4,
      routeText: '란타우섬 - 홍콩 디즈니랜드',
      destination: '홍콩',
    })
    const d4 = composeScheduleImageSeoTitleKr({
      day: 4,
      maxDay: 4,
      routeText: '인천',
      destination: '홍콩',
    })
    expect(d1).toMatch(/헐리우드|소호|피크|홍콩/)
    expect(d3).toMatch(/디즈니|란타우/)
    expect(d4).toBe('귀국')
    expect(d1).not.toMatch(/DAY|라오스|Incheon/i)
  })

  it('resolve prefers stored clean title, else composes', () => {
    expect(
      resolveScheduleImageSeoTitleKr({
        stored: '라오스(비엔티엔) · DAY5',
        day: 2,
        maxDay: 5,
        routeText: '가든스 바이 더 베이 - 머라이언',
        destination: '싱가포르',
      }),
    ).toMatch(/가든스|머라이언|싱가포르/)
    expect(
      resolveScheduleImageSeoTitleKr({
        stored: '머라이언',
        day: 2,
        maxDay: 5,
        routeText: '가든스 바이 더 베이',
      }),
    ).toBe('머라이언')
  })

  it('public caption does not use English keyword or polluted attraction', () => {
    const cap = resolveScheduleThumbCaption({
      imageKeyword: 'Incheon',
      imageSeoTitleKr: null,
      imageAttractionName: '라오스(비엔티엔) · DAY5',
      imageDisplayNameManual: null,
      derivedFromUrl: null,
    })
    expect(cap).toBeNull()

    const ok = resolveScheduleThumbCaption({
      imageKeyword: 'Universal Studios Singapore',
      imageSeoTitleKr: '유니버설 스튜디오',
      imageAttractionName: '라오스(비엔티엔) · DAY5',
    })
    expect(ok).toBe('유니버설 스튜디오')
  })
})
