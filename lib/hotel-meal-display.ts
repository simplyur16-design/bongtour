/**
 * 상세 일정 카드 — 호텔/식사 표시용 (원문 기반, 추론 금지).
 *
 * 운영 E2E 체크 항목: `lib/register-flow/hotel-meal-e2e-checklist.ts` 참고.
 * 공개 호텔 한 줄 scrub: `lib/public-hotel-display-ssot.ts`
 */

import {
  scrubPublicHotelDisplayLine,
  scrubPublicHotelNameList,
} from '@/lib/public-hotel-display-ssot'

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
  // REGRESSION-FREEZE[public-hotel-display-scrub]: 공개 호텔명 scrub — manifest
  const names = scrubPublicHotelNameList(params.hotelNames)
  if (names.length >= 2) return `${names[0]} 외 ${names.length - 1}`
  if (names.length === 1) return names[0]!
  const summary = scrubPublicHotelDisplayLine(params.hotelSummaryText)
  if (summary) return summary
  return scrubPublicHotelDisplayLine(params.dayHotelText)
}

export type FormatMealDisplayParams = {
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
  mealSummaryText?: string | null
  /** ItineraryDay.meals 레거시 한 줄(등록 파이프·스크래핑이 조·중·석 대신 넣는 경우). 위 필드가 비었을 때만 사용 */
  mealsLegacy?: string | null
}

/**
 * 식사 표시: `아침 - 호텔식, 점심 - 현지식, 저녁 - 현지식` 한 줄(배열 1요소).
 * 일부만 있으면 있는 끼만; mealSummaryText만 있으면 그대로 1요소.
 * 조·중·석·mealSummary가 모두 비었을 때 mealsLegacy만 있으면 그대로 1요소.
 * 전부 없으면 `식사 - 불포함`.
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
  const legacy = trimOrNull(params.mealsLegacy)
  if (legacy) return [legacy]
  return ['식사 - 불포함']
}

/** 귀국·도착일(일차별 숙소 없음)에 상품 대표 호텔명을 끼워 넣지 않는다. */
export function isLikelyReturnArrivalDayWithoutHotel(description: string | null | undefined): boolean {
  const t = (description ?? '').replace(/\r/g, '\n')
  if (!/도착/.test(t)) return false
  if (/호텔\s*투숙|숙박/.test(t)) return false
  if (/\bOZ\d+편\s*인천\s*출발|인천\s*출발|\[.*\]\s*.*인천\s*출발/.test(t)) return false
  if (/(인천국제공항|인천\s*국제\s*공항|제\s*\d+\s*터미널|\(T2\)|\bT2\b)/i.test(t) && /도착/.test(t)) return true
  // no-hotel-day-display-1031 (B): `[18:20] 인천 도착`·`김해 도착`·귀국 문구도 귀국일로 인식
  if (NO_HOTEL_RETURN_ARRIVAL_RE.test(t)) return true
  return false
}

/** no-hotel-day-display-1031 (B): 국내 공항 도착·귀국 (마지막 일차에서만 사용) */
const NO_HOTEL_RETURN_ARRIVAL_RE =
  /(?:인천|김포|김해|부산|대구|청주|제주|무안|양양)\s*(?:국제\s*)?(?:공항\s*)?(?:\([^)]*\)\s*)?도착|귀국/u

/**
 * no-hotel-day-display-1031 (A): 공급사 일차 숙소가 「숙박 없음」 명시(기내박·기내숙박·숙박 없음(귀국)·차중박 등).
 * 이 경우 상품 대표 호텔(hotelSummaryText·hotelNames)로 폴백하지 않는다. 문자열 전체가 무숙박 표기일 때만.
 */
const EXPLICIT_NO_HOTEL_DAY_RE =
  /^(?:[:：·\-]\s*)?(?:기내\s*(?:박|숙박)|숙박\s*(?:없음|없슴|안\s*함|불포함)|숙소\s*없음|호텔\s*없음|무박|차중\s*박|야간\s*열차\s*박)\s*(?:\(\s*[^)]*\))?\s*\.?$/u

export function isExplicitNoHotelDayText(raw: string | null | undefined): boolean {
  const t = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return false
  return EXPLICIT_NO_HOTEL_DAY_RE.test(t)
}

/**
 * no-hotel-day-render-model-1031 (fix A): 상품 상세 렌더 모델의 일차 hotelText.
 * 무숙박 판단은 scrub **전** 원문으로 한다. 기내박·숙박 없음(귀국) 등은 scrub 이 null 로 지워
 * formatScheduleDayHotelLine 의 무숙박 검사가 못 보고 상품 대표 호텔로 폴백했으므로,
 * 무숙박 명시 원문은 그대로 남긴다(화면에는 formatScheduleDayHotelLine 이 null → 숙소 줄 숨김).
 * 그 밖의 문구는 기존 그대로 scrubPublicHotelDisplayLine 결과.
 */
export function resolvePublicScheduleDayHotelText(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim()
  if (!t) return null
  if (isExplicitNoHotelDayText(t)) return t
  return scrubPublicHotelDisplayLine(t) ?? null
}

/**
 * 일정 day 카드용: dayHotelText 우선, 없으면 상품 호텔만 formatHotelDisplay(day 제외).
 * 마지막 일차가 귀국 도착인데 dayHotelText가 비었으면 상품 hotelNames 폴백을 쓰지 않는다.
 */
export function formatScheduleDayHotelLine(params: {
  hotelNames?: string[] | null
  hotelSummaryText?: string | null
  dayHotelText?: string | null
  isLastScheduleRow?: boolean
  dayDescription?: string | null
}): string | null {
  // REGRESSION-FREEZE[public-hotel-display-scrub]: day 호텔 scrub — manifest
  const day = scrubPublicHotelDisplayLine(params.dayHotelText)
  if (day) return day
  // no-hotel-day-display-1031 (A): 공급사가 무숙박(기내박 등) 명시 → 상품 대표 호텔 폴백 금지
  if (isExplicitNoHotelDayText(params.dayHotelText)) return null
  if (
    params.isLastScheduleRow &&
    isLikelyReturnArrivalDayWithoutHotel(params.dayDescription)
  ) {
    return null
  }
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
| mealsLegacy만       | —                                                | [원문 한 줄]             |
| dayHotelText 우선   | formatScheduleDayHotelLine 에서 day 먼저       | —                        |
*/
