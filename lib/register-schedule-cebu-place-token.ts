/**
 * 세부(Cebu) 장소 토큰 — 세부일정·세부안내 등 운영 문구와 구분.
 * REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: 세부일정≠Cebu (Okinawa bleed) — manifest
 */

/** soft-alt·POI cityRe용 — 세부(Cebu)만, 세부일정·세부안내 제외 */
// REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: 세부일정≠Cebu cityRe — manifest
export const CEBU_KO_PLACE_CITY_RE =
  /(?<![가-힣])세부(?!\s*(?:일정|안내|사항|내용|정보|규정|확인|내역|설명))(?![가-힣])/u

/**
 * hay에 Cebu(세부) 장소가 있는지 — 세부일정/세부안내 오탐 금지.
 */
export function hayHasCebuPlaceToken(hay: string | null | undefined): boolean {
  const t = String(hay ?? '')
  if (!t.trim()) return false
  if (
    /\bCebu\b|모알보알|Moalboal|오슬롭|Oslob|가와산|Kawasan|막탄|Mactan|까띠끌란|Katiklan/i.test(t)
  ) {
    return true
  }
  return CEBU_KO_PLACE_CITY_RE.test(t)
}
