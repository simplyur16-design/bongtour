/**
 * 상품 유형(패키지 vs 자유여행) — 공급사 원문에 일자별 일정이 있는지 하나만 본다.
 * REGRESSION-FREEZE[admin-register-kind-itinerary]: 사장님 규칙(2026-10-27/30) — 가이드·가이드비·쇼핑·공급사 코드 글자로 가르지 않는다 — manifest
 *
 * - 패키지: 원문 일정 중 첫날·마지막날을 뺀 날(2~3일짜리는 전 일차) 가운데 하루라도 구체 일정(관광·방문지 등)이 있음
 * - 자유여행: 일정이 비었거나, 중간 일차가 전부 '자유일정'이거나 내용 없음
 */
export type ItineraryDayLike = {
  day?: number | string | null
  title?: string | null
  description?: string | null
  routeText?: string | null
}

export type ItineraryProductKind = 'package' | 'air_hotel_free'

const FREE_DAY_RE = /(일일\s*)?자유\s*(일정|시간|여행|관광)|전일\s*자유|하루\s*자유|free\s*(day|time)/i
/** 하루 전체가 자유 — 같은 날 '추천·선택' 카드가 붙어 있어도 자유일로 본다 (원문 표기 우선) */
const FULL_DAY_FREE_RE = /(일일|전일|하루|종일)\s*자유/
const NON_CONTENT_RE = /^\s*(\d+\s*일차|숙박\s*없음\(귀국\)|호텔\s*(조식|체크인|휴식)[^]*?)?\s*$/

function dayText(d: ItineraryDayLike): string {
  return [d.title, d.routeText, d.description].map((x) => String(x ?? '').trim()).filter(Boolean).join(' \n ')
}

export function isItineraryDayFree(d: ItineraryDayLike): boolean {
  const t = dayText(d)
  if (!t || NON_CONTENT_RE.test(t)) return true
  if (FULL_DAY_FREE_RE.test(t)) return true
  if (!FREE_DAY_RE.test(t)) return false
  // 자유일정 문구가 있어도 같은 날 '관광' 등 구체 일정이 함께 적혀 있으면 구체 일정 있는 날로 본다
  const withoutFree = t
    .replace(/※[^\n]*/g, ' ') // 안내 주석(동행·유의 문구)은 일정 내용이 아님
    .replace(new RegExp(FREE_DAY_RE.source, 'gi'), ' ').replace(/[\s\-·,./()\[\]※]+/g, '')
  return !/관광|방문|투어|탑승|체험|감상|입장/.test(withoutFree)
}

export function inferProductKindFromOriginalItinerary(days: readonly ItineraryDayLike[] | null | undefined): ItineraryProductKind {
  const list = (days ?? []).filter((d) => dayText(d).length > 0)
  if (list.length === 0) return 'air_hotel_free'
  const middle = list.length >= 4 ? list.slice(1, -1) : list
  return middle.some((d) => !isItineraryDayFree(d)) ? 'package' : 'air_hotel_free'
}

/** 관리자 등록 저장 kind — 메뉴 선택·코드 글자 대신 원문 일정 유무로 결정 */
export function applyItineraryKindToTravelScope(
  _selected: 'overseas' | 'air_hotel_free',
  schedule: readonly ItineraryDayLike[] | null | undefined,
): 'overseas' | 'air_hotel_free' {
  return inferProductKindFromOriginalItinerary(schedule) === 'package' ? 'overseas' : 'air_hotel_free'
}

/** 공급사 팩트 일정(places 목록) 일차 — RegisterFactScheduleDay 와 같은 모양 */
export type FactScheduleDayLike = {
  day?: number | string | null
  places?: readonly string[] | null
  transportNote?: string | null
}

/**
 * 자동 수집·팩트 번들 경로용 — 원문 일자별 일정(places)으로 kind.
 * 일정이 아예 비었으면 null(판단 보류: 기존 경로가 schedule_facts_empty 차단 등 처리).
 * REGRESSION-FREEZE[admin-register-kind-itinerary]: 신규·등록대기·등록 모두 같은 규칙 — manifest
 */
export function inferProductKindFromFactScheduleDays(
  days: readonly FactScheduleDayLike[] | null | undefined,
): ItineraryProductKind | null {
  if (!Array.isArray(days) || days.length === 0) return null
  return inferProductKindFromOriginalItinerary(
    days.map((d, i) => {
      const text = (d.places ?? []).map((p: string) => String(p ?? '').trim()).filter(Boolean).join(' · ')
      // 내용 없는 일차도 자리(일차 위치)는 유지 — 'N일차'는 내용 없음으로 본다
      return { day: d.day ?? i + 1, description: text || `${d.day ?? i + 1}일차` }
    }),
  )
}
