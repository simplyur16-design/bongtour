/**
 * 기내박(in-flight night) — 파서 단계에서 숙박 없음으로 취급.
 * 공급사 fact 변환기(hotels[] → hotelText)·title 폴백·post-augment 최종 패스가 공유한다.
 * 기내박 일차 hotelText 는 `숙박 없음(기내박)` 으로 고정한다 — hotel-meal-display 의
 * isExplicitNoHotelDayText 가 무숙박으로 인식해 상품 대표 호텔 폴백을 막는다.
 * REGRESSION-FREEZE[register-schedule-hotel-inflight]: 기내박 ≠ 호텔 — manifest
 */

export const REGISTER_SCHEDULE_INFLIGHT_NO_HOTEL_TEXT = '숙박 없음(기내박)'

const INFLIGHT_NIGHT_RE =
  /^(?:[:：·\-]\s*)?(?:(?:해당\s*일의\s*)?숙박(?:은|:)?\s*)?(?:기내\s*(?:박|숙박|\d\s*박)|기중\s*박|in[-\s]?flight(?:\s*night)?|overnight\s*(?:on\s*(?:the\s*)?)?flight|night\s*flight)(?:\s*입니다)?\s*(?:\(\s*[^)]*\))?\s*[.。]?(?:\s*변동이\s*있을\s*경우.*)?$/iu

/** 문자열 전체가 기내박 표기인지 (`기내박`, `기내박()`, `: 기내박`, `기내 숙박`, `In-flight` …) */
export function isRegisterScheduleInFlightNightLabel(raw: string | null | undefined): boolean {
  const t = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return false
  return INFLIGHT_NIGHT_RE.test(t)
}

/** 문장 안에 기내박 표기가 섞여 있는지 (`해당 일의 숙박은 기내박 입니다` 등) */
export function registerScheduleTextMentionsInFlightNight(raw: string | null | undefined): boolean {
  return /기내\s*(?:박|숙박|\d\s*박)|in[-\s]?flight\s*night|overnight\s*flight/iu.test(String(raw ?? ''))
}

/**
 * fact hotels[] → 일차 hotelText.
 * - 기내박 항목은 호텔로 쓰지 않는다.
 * - 기내박만 있으면 `숙박 없음(기내박)` (무숙박 명시).
 * - 실제 호텔이 함께 있으면 호텔만 남긴다.
 */
export function registerScheduleHotelTextFromFactHotels(
  hotels: ReadonlyArray<string | null | undefined> | null | undefined,
): string | null {
  const list = (hotels ?? []).map((h) => String(h ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (list.length === 0) return null
  const real = list.filter(
    (h) => !isRegisterScheduleInFlightNightLabel(h) && !isInFlightOnlySentence(h),
  )
  if (real.length > 0) return [...new Set(real)].join(' / ')
  return REGISTER_SCHEDULE_INFLIGHT_NO_HOTEL_TEXT
}

/** 이미 만들어진 hotelText 정규화 — post-augment 최종 패스·LLM 경로 공용 */
export function normalizeRegisterScheduleDayHotelText(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const parts = t.split(/\s+\/\s+/).map((s) => s.trim()).filter(Boolean)
  if (!parts.some((p) => isRegisterScheduleInFlightNightLabel(p) || isInFlightOnlySentence(p))) return t
  return registerScheduleHotelTextFromFactHotels(parts)
}

/** `해당 일의 숙박은 기내박 입니다. 변동이 있을 경우 …` 처럼 호텔명 없이 기내박만 안내하는 문장 */
function isInFlightOnlySentence(t: string): boolean {
  if (!registerScheduleTextMentionsInFlightNight(t)) return false
  // 기내박 + 실제 숙소 (예: `기내박 후 힐튼 호텔 투숙`) 는 호텔 문장으로 유지
  return !/호텔|hotel|resort|리조트|inn\b|숙소\s*[:：]|투숙/iu.test(t)
}
