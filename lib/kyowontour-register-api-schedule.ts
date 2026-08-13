/**
 * 교원이지(kyowontour) 등록 일정 표현 SSOT — routeText(a–g ` - `) · description(공급사 문장 우선, 없으면 route 명소 2~3문장).
 * REGRESSION-FREEZE[kyowontour-schedule-expression]: routeText·description vibe — manifest
 */
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-kyowontour'
import { parseFactMealsListToScheduleFields } from '@/lib/register-schedule-meal-parse'
import {
  composeLottetourScheduleDescription,
  dedupeLottetourScheduleRoutePlaces,
  joinLottetourScheduleRouteText,
} from '@/lib/lottetour-register-api-schedule'
import { composeRegisterScheduleDayTitleFromRoute } from '@/lib/register-schedule-day-title'
import { isRegisterScheduleRoutePlaceNoise } from '@/lib/register-schedule-route-place-noise'
import type { KyowontourScheduleRowParsed } from '@/lib/kyowontour-tour-event-tab-data'

export const KYOWONTOUR_SCHEDULE_ROUTE_MAX = 7

const KYOWONTOUR_AIRPORT_CITY: Record<string, string> = {
  ICN: '인천',
  GMP: '김포',
  PUS: '부산',
  CJU: '제주',
  TAE: '대구',
  CJJ: '청주',
}

/** goodsEvtTab_2 행 nameKo → routeText 세그먼트 (호텔·체크인 제외, step 순서 유지) */
export function stripKyowontourScheduleRowName(name: string): string {
  return String(name ?? '')
    .replace(/&amp;|&#38;/gi, '&')
    // REGRESSION-FREEZE[kyowontour-schedule-expression]: L&aelig;rdal HTML entity → æ — manifest
    .replace(/&aelig;|&#230;|&#xE6;/gi, 'æ')
    .replace(/&AElig;|&#198;|&#xC6;/g, 'Æ')
    .replace(/^[\s▶■◎●]+/, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, ' ')
    .replace(/▷|■|⭐/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function kyowontourTabRowToRoutePlace(row: KyowontourScheduleRowParsed): string | null {
  if (row.type === '호텔') return null
  const raw = stripKyowontourScheduleRowName(row.nameKo)
  if (!raw) return null
  if (/^체크\s*(?:인|아웃)|자유\s*시간|휴식/.test(raw) && raw.length < 28) return null

  const airport = raw.match(
    /^(인천|김포|부산|제주|대구|청주|ICN|GMP|PUS|CJU|TAE|CJJ)(?:\s*국제)?\s*공항(?:\s*(?:출발|도착|경유|미팅))?/iu,
  )
  if (airport) {
    const token = airport[1]!.toUpperCase()
    return KYOWONTOUR_AIRPORT_CITY[token] ?? airport[1]!
  }

  let label = raw.replace(/^[\s▶●]+/, '').trim()
  if (isRegisterScheduleRoutePlaceNoise(label)) return null
  const tour = label.match(/^(.+?)\s*(?:관광|방문|체험|투어|탐방)(?:\([^)]*\))?$/u)
  if (tour?.[1]) label = tour[1]!.trim()

  const places = dedupeLottetourScheduleRoutePlaces([label])
  return places[0] ?? null
}

/** 여행일정표 탭 행 — 일정요약 routeText `a - b - c` (최대 7) */
export function buildKyowontourScheduleRouteTextFromTabRows(rows: KyowontourScheduleRowParsed[]): string | null {
  const sorted = [...rows].sort((a, b) => a.step - b.step)
  const places: string[] = []
  for (const row of sorted) {
    const place = kyowontourTabRowToRoutePlace(row)
    if (place) places.push(place)
  }
  return joinLottetourScheduleRouteText(places, KYOWONTOUR_SCHEDULE_ROUTE_MAX)
}

export function kyowontourFactDaysToRegisterSchedule(days: RegisterFactScheduleDay[]): RegisterScheduleDay[] {
  const maxDay = days.reduce((m, d) => Math.max(m, d.day), 0)
  return days.map((d) => {
    const routePlaces = dedupeLottetourScheduleRoutePlaces(d.places)
    const routeText = joinLottetourScheduleRouteText(routePlaces)
    const joinedBlob = [d.transportNote, routeText, ...routePlaces, ...d.places].filter(Boolean).join(' ')
    // REGRESSION-FREEZE[register-schedule-day-title-ssot]: short title from route — manifest
    // REGRESSION-FREEZE[kyowontour-schedule-expression]: 귀국일 vibe title → 귀국 — manifest
    const title = composeRegisterScheduleDayTitleFromRoute({
      day: d.day,
      maxDay,
      routeText,
      fallbacks: [String(d.transportNote ?? '').split(';')[0], d.hotels[0]],
      returnTitle: '귀국',
    })
    const description = composeLottetourScheduleDescription({
      day: d.day,
      maxDay,
      routePlaces,
      joinedBlob,
    })
    const meals = parseFactMealsListToScheduleFields(d.meals)
    return {
      day: d.day,
      title,
      description,
      routeText,
      imageKeyword: '',
      imageKeyword2: null,
      hotelText: d.hotels.length > 0 ? d.hotels.join(' / ') : null,
      breakfastText: meals.breakfastText ?? null,
      lunchText: meals.lunchText ?? null,
      dinnerText: meals.dinnerText ?? null,
      mealSummaryText: meals.mealSummaryText ?? null,
    }
  })
}

/** 등록 schedule[] — routeText·description 일괄 보정 (붙여넣기·collect 병합 후) */
export function applyKyowontourScheduleExpressionToRows<T extends RegisterScheduleDay>(rows: T[]): T[] {
  const maxDay = rows.reduce((m, r) => Math.max(m, Number(r.day) || 0), 0)
  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    const fromRoute = row.routeText ? dedupeLottetourScheduleRoutePlaces(row.routeText.split(/\s*-\s*/)) : []
    const routePlaces = dedupeLottetourScheduleRoutePlaces(fromRoute)
    // join 내부 sanitize — 전부 noise면 null (dirty row.routeText 되살리기 금지)
    const routeText = joinLottetourScheduleRouteText(routePlaces, KYOWONTOUR_SCHEDULE_ROUTE_MAX)
    const joinedBlob = [row.title, row.description, routeText].filter(Boolean).join('\n')
    const description = composeLottetourScheduleDescription({
      day,
      maxDay,
      routePlaces,
      joinedBlob,
      supplierText: row.description,
    })
    // REGRESSION-FREEZE[register-schedule-day-title-ssot]: short title from route — manifest
    // REGRESSION-FREEZE[kyowontour-schedule-expression]: 귀국일 vibe title → 귀국 — manifest
    const title = composeRegisterScheduleDayTitleFromRoute({
      day,
      maxDay,
      routeText,
      fallbacks: [row.title],
      returnTitle: '귀국',
    })
    return { ...row, routeText, description, title }
  })
}
