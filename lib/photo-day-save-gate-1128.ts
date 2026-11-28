/**
 * 사진 저장 전 공통 게이트(봉실장 11:18 / 사장님 08:55–08:57).
 * 1순위: 그날 원문에 나열된 명소. 2순위: 원문에 명소가 없고 머무는 날일 때만 그날 도시 대표명소.
 * 귀국·출국·공항만 있는 날, 도시 사이 이동만 있는 날은 빈칸.
 * 다른 일차 키워드·도시명 단독 검색 금지. 같은 파일을 다른 상품에 재사용 금지.
 * REGRESSION-FREEZE[photo-wrong-path-1128]: 틀린 사진 경로 차단 — manifest
 */
import { deriveDaySights, type DaySightInput, type DaySightResult } from '@/lib/photo-autofill-sight'
import { registerScheduleDayIsCityOnlyPhotoSkip, registerScheduleRouteIsCityOnlyTransit } from '@/lib/register-schedule-city-only-day'
import { registerTravelDayKind, type TravelDayRow } from '@/lib/register-day-photo-travel-day'

const FREE_DAY_RE = /추천일정|자유\s*일정|자유\s*시간|자유\s*관광|free\s*(?:day|time)/iu
const RETURN_RE = /숙박\s*없음|귀국/u
const AIRPORT_RE = /공항|airport/iu
const MOVE_TITLE_RE = /이동/u
const KOREA_HUB_RE = /인천|김포|김해|청주|부산|대구|광주|제주|무안/u

export type DaySaveRow = DaySightInput & {
  day?: number | null
  hotelText?: string | null
  imageUrl?: string | null
}

export type DaySavePlan =
  | { action: 'search'; route: 'own' | 'city_rep'; sights: string[]; derived: DaySightResult }
  | { action: 'empty'; reason: 'travel_airport_only' | 'city_transit_only'; derived: DaySightResult }
  | { action: 'skip'; reason: string; derived: DaySightResult }

function blob(row: DaySaveRow): string {
  return [row.title, row.routeText, row.description, row.hotelText].map((x) => String(x ?? '')).join(' ')
}

function asTravelRow(row: DaySaveRow): TravelDayRow {
  return {
    day: Number(row.day) || 0,
    title: row.title ?? null,
    routeText: row.routeText ?? null,
    hotelText: row.hotelText ?? null,
    description: row.description ?? null,
    imageKeyword: row.imageKeyword ?? null,
    imageUrl: row.imageUrl ?? null,
  }
}

/** 자유일정·추천일정이 아니고, 출국·귀국·공항만·도시 이동만인 날 */
export function isTravelAirportOnlyDay(row: DaySaveRow, maxDay: number, rows?: ReadonlyArray<DaySaveRow>): boolean {
  const text = blob(row)
  if (FREE_DAY_RE.test(text)) return false
  if (RETURN_RE.test(`${row.hotelText ?? ''} ${row.title ?? ''} ${row.routeText ?? ''} ${row.description ?? ''}`)) return true
  const kind = registerTravelDayKind(asTravelRow(row), maxDay)
  if (kind === 'return' || kind === 'departure' || kind === 'transit') return true
  const day = Number(row.day) || 0
  // 국내 허브 출발·도착(호텔 체크인만) — 원문 명소는 plan 이 1순위로 먼저 살핀다
  if (KOREA_HUB_RE.test(text) && (AIRPORT_RE.test(text) || /출발|도착|호텔/u.test(text))) return true
  if (MOVE_TITLE_RE.test(String(row.title ?? '') + String(row.routeText ?? ''))) return true
  if (registerScheduleRouteIsCityOnlyTransit(row.routeText)) return true
  if (rows && maxDay >= 2 && day === maxDay && (RETURN_RE.test(text) || AIRPORT_RE.test(text))) return true
  void rows
  return false
}

export function planDayPhotoSave(
  row: DaySaveRow,
  opts: { destinationText?: string | null; maxDay: number; allRows?: ReadonlyArray<DaySaveRow> },
): DaySavePlan {
  const derived = deriveDaySights(
    {
      title: row.title,
      routeText: row.routeText,
      description: row.description,
      imageKeyword: row.imageKeyword,
      imageKeyword2: row.imageKeyword2,
      supplierText: row.supplierText,
      otherDaysText: row.otherDaysText,
    },
    opts.destinationText ?? '',
  )
  if (derived.route === 'own' && derived.sights.length > 0) {
    return { action: 'search', route: 'own', sights: derived.sights, derived }
  }
  const travel = isTravelAirportOnlyDay(row, opts.maxDay, opts.allRows)
  const transit = registerScheduleRouteIsCityOnlyTransit(row.routeText) && !FREE_DAY_RE.test(blob(row))
  const citySkip = registerScheduleDayIsCityOnlyPhotoSkip({ title: row.title, routeText: row.routeText })
  if (travel || transit || (citySkip && !FREE_DAY_RE.test(blob(row)))) {
    const reason = travel ? 'travel_airport_only' : 'city_transit_only'
    return { action: 'empty', reason, derived }
  }
  if (derived.route === 'city_rep' && derived.sights.length > 0) {
    return { action: 'search', route: 'city_rep', sights: derived.sights, derived }
  }
  return { action: 'skip', reason: derived.reason, derived }
}

export function planKeepReason(plan: DaySavePlan): string | null {
  if (plan.action === 'empty') return plan.reason
  if (plan.action === 'skip') return plan.reason.startsWith('no_sight') || plan.reason.includes(':') ? (plan.reason.includes(':') ? plan.reason : `no_sight:${plan.reason}`) : plan.reason
  return null
}
