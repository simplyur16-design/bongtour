/**
 * no-hotel-day-render-model-1031 (fix A) — 렌더 모델 일차 hotelText 는 무숙박 판단을 scrub 전 원문으로.
 * 렌더 모델(resolvePublicScheduleDayHotelText) → 화면(formatScheduleDayHotelLine) 경로 그대로 검증.
 */
import { describe, expect, it } from 'vitest'
import { formatScheduleDayHotelLine, resolvePublicScheduleDayHotelText } from '@/lib/hotel-meal-display'
import { scrubPublicHotelDisplayLine } from '@/lib/public-hotel-display-ssot'

const SUMMARY = '전 일정 1~2급 호텔 숙박 기준이나 현지 사정에 따라 3성급으로 대체될 수 있습니다.'

function shownViaRenderModel(raw: string | null, isLastScheduleRow = false, dayDescription: string | null = null) {
  return formatScheduleDayHotelLine({
    hotelSummaryText: SUMMARY,
    hotelNames: ['Caesar Metro Taipei'],
    dayHotelText: resolvePublicScheduleDayHotelText(raw),
    isLastScheduleRow,
    dayDescription,
  })
}

describe('fix A: 무숙박 명시 일차는 렌더 모델을 거쳐도 숙소 줄 숨김', () => {
  it.each(['기내박', '기내박()', ': 기내박', '기내숙박', '숙박 없음', '숙박 없음(귀국)', ' 숙박 없음(귀국) '])(
    '%s → 렌더 모델에 원문 유지, 화면 숙소 줄 없음',
    (raw) => {
      expect(resolvePublicScheduleDayHotelText(raw)).toBe(raw.trim())
      expect(shownViaRenderModel(raw, false)).toBeNull()
      expect(shownViaRenderModel(raw, true)).toBeNull()
    },
  )

  it('수정 전 경로(scrub 먼저)는 폴백이 보였음 — 회귀 기록', () => {
    const before = formatScheduleDayHotelLine({
      hotelSummaryText: SUMMARY,
      dayHotelText: scrubPublicHotelDisplayLine('기내박') ?? null,
    })
    expect(before).toBe(SUMMARY)
  })
})

describe('fix A: 실제 호텔·그 밖의 문구는 기존 scrub 그대로', () => {
  it.each(['Caesar Metro Taipei', 'MOVENPICK SOMABAY 또는 동급', '천부 국제호텔', '예정 호텔(출발 전 확정)', '조식 호텔식', ''])(
    '%s → scrubPublicHotelDisplayLine 결과와 동일',
    (raw) => {
      expect(resolvePublicScheduleDayHotelText(raw)).toBe(scrubPublicHotelDisplayLine(raw) ?? null)
    },
  )

  it('실제 호텔명은 그날 숙소 줄로 표시', () => {
    const raw = 'MOVENPICK SOMABAY 또는 동급'
    const shown = shownViaRenderModel(raw)
    expect(shown).toBe(scrubPublicHotelDisplayLine(raw))
    expect(shown).toContain('MOVENPICK SOMABAY')
  })

  it('null → null, 일반 일차는 상품 대표 호텔 폴백 유지', () => {
    expect(resolvePublicScheduleDayHotelText(null)).toBeNull()
    expect(shownViaRenderModel(null, false)).not.toBeNull()
  })
})
