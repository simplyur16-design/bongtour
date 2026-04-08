/**
 * 상세 일정 카드 — 호텔/식사 표시용 (원문 기반, 추론 금지).
 *
 * 운영 E2E 체크 항목: `lib/register-flow/hotel-meal-e2e-checklist.ts` 참고.
 */

export type HotelMealLabels = {
  hotelBlockTitle: string
  mealBlockTitle: string
  breakfast: string
  lunch: string
  dinner: string
}

export function getHotelMealLabels(travelScope: 'domestic' | 'overseas'): HotelMealLabels {
  if (travelScope === 'domestic') {
    return {
      hotelBlockTitle: '숙소정보',
      mealBlockTitle: '식사',
      breakfast: '아침',
      lunch: '점심',
      dinner: '저녁',
    }
  }
  return {
    hotelBlockTitle: '예정호텔',
    mealBlockTitle: '식사',
    breakfast: '아침',
    lunch: '점심',
    dinner: '저녁',
  }
}

function trimOrNull(s: string | null | undefined): string | null {
  if (s == null || typeof s !== 'string') return null
  const t = s.trim()
  return t.length > 0 ? t : null
}

/** @internal 테스트·가독성용 */
export function isNonEmptyString(s: string | null | undefined): s is string {
  return trimOrNull(s) != null
}

export type FormatHotelDisplayParams = {
  hotelNames?: string[] | null
  hotelSummaryText?: string | null
  dayHotelText?: string | null
}

/**
 * 호텔 한 줄 문자열 (대표호텔명 외 n 규칙).
 * 순서: hotelNames(2+ → 외 n, 1 → 단일) → hotelSummaryText → dayHotelText → null
 */
export function formatHotelDisplay(params: FormatHotelDisplayParams): string | null {
  const names = (params.hotelNames ?? [])
    .map((x) => String(x).trim())
    .filter((x) => x.length > 0)
  if (names.length >= 2) return `${names[0]} 외 ${names.length - 1}`
  if (names.length === 1) return names[0]!
  const summary = trimOrNull(params.hotelSummaryText)
  if (summary) return summary
  return trimOrNull(params.dayHotelText)
}

export type FormatMealDisplayParams = {
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
  mealSummaryText?: string | null
}

/**
 * 식사 표시: `아침 - 호텔식, 점심 - 현지식, 저녁 - 현지식` 한 줄(배열 1요소).
 * 일부만 있으면 있는 끼만; 전부 없으면 `식사 - 불포함`. mealSummaryText만 있으면 그대로 1요소.
 */
export function formatMealDisplay(params: FormatMealDisplayParams): string[] {
  const parts: string[] = []
  const b = trimOrNull(params.breakfastText)
  const l = trimOrNull(params.lunchText)
  const d = trimOrNull(params.dinnerText)
  if (b) parts.push(`아침 - ${b}`)
  if (l) parts.push(`점심 - ${l}`)
  if (d) parts.push(`저녁 - ${d}`)
  if (parts.length > 0) return [parts.join(', ')]
  const m = trimOrNull(params.mealSummaryText)
  if (m) return [m]
  return ['식사 - 불포함']
}

/**
 * 일정 day 카드용: dayHotelText 우선, 없으면 상품 호텔만 formatHotelDisplay(day 제외).
 */
export function formatScheduleDayHotelLine(params: {
  hotelNames?: string[] | null
  hotelSummaryText?: string | null
  dayHotelText?: string | null
}): string | null {
  const day = trimOrNull(params.dayHotelText)
  if (day) return day
  return formatHotelDisplay({
    hotelNames: params.hotelNames,
    hotelSummaryText: params.hotelSummaryText,
    dayHotelText: null,
  })
}

/** 상품 상단 "호텔 정보" 블록 한 줄 (일차 전용 텍스트 제외) */
export function formatProductHotelSummaryLine(
  names: string[] | null | undefined,
  summary: string | null | undefined
): string | null {
  return formatHotelDisplay({ hotelNames: names, hotelSummaryText: summary, dayHotelText: null })
}

/*
회귀 기대 (scripts/verify-hotel-meal-display.ts 와 동일)
| 케이스              | formatHotelDisplay / formatScheduleDayHotelLine | formatMealDisplay        |
|---------------------|--------------------------------------------------|--------------------------|
| names 2+            | 첫번째 외 (n-1)                                  | —                        |
| names 1             | 단일명                                           | —                        |
| 식사 3값            | —                                                | 한 줄 콤마 구분          |
| mealSummary만       | —                                                | 단일 요소 배열           |
| 전부 없음           | null / day 없으면 null                           | ['식사 - 불포함']        |
| dayHotelText 우선   | formatScheduleDayHotelLine 에서 day 먼저       | —                        |
*/
