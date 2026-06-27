/**
 * 교원이지 등록 — goodsEvtTab_2 AJAX로 여행일정표 자동 수집.
 * 붙여넣기·LLM 일정이 비어 있을 때만 보강(운영자 입력 SSOT 우선).
 *
 * REGRESSION-FREEZE[kyowontour-tour-event-tab-opt-shop]: schedule collect mapping — manifest
 */
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-kyowontour'
import type { KyowontourScheduleRowParsed, KyowontourScheduleTabParsed } from '@/lib/kyowontour-tour-event-tab-data'
import { applyKyowontourScheduleImageKeywordsToRows } from '@/lib/kyowontour-schedule-image-keyword'
import { kyowontourFactDaysToRegisterSchedule } from '@/lib/kyowontour-register-api-schedule'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import {
  mergeScheduleDaysPreservingExpressionMergingMealHotel,
  scheduleNeedsMealHotelCollect,
  isEmptyMealHotelField,
} from '@/lib/register-schedule-meal-hotel-merge'
import { enrichScheduleMealFieldsFromText } from '@/lib/register-schedule-meal-parse'

function stripScheduleNameKo(name: string): string {
  return name.replace(/^[\s▶■◎●]+/, '').replace(/\s+/g, ' ').trim()
}

function scheduleRowLooksMeaningful(row: KyowontourScheduleRowParsed): boolean {
  const name = stripScheduleNameKo(row.nameKo)
  if (!name) return false
  if (row.type === '호텔' && /체크인|체크\s*아웃|휴식|자유\s*시간/.test(name) && name.length < 24) return false
  return true
}

function pickDayTitle(rows: KyowontourScheduleRowParsed[], day: number): string {
  const spot = rows.find((r) => r.type === '관광지' && stripScheduleNameKo(r.nameKo))
  if (spot) return stripScheduleNameKo(spot.nameKo).slice(0, 120)
  const direct = rows.find((r) => r.type === '직접입력' && stripScheduleNameKo(r.nameKo).length > 2)
  if (direct) return stripScheduleNameKo(direct.nameKo).slice(0, 120)
  const city = rows.find((r) => r.type === '국가/도시' && stripScheduleNameKo(r.nameKo))
  if (city) return stripScheduleNameKo(city.nameKo).slice(0, 120)
  return `${day}일차`
}

function buildRouteText(rows: KyowontourScheduleRowParsed[]): string | null {
  const parts = rows
    .filter((r) => (r.type === '관광지' || r.type === '국가/도시') && stripScheduleNameKo(r.nameKo))
    .map((r) => stripScheduleNameKo(r.nameKo))
  if (parts.length === 0) return null
  return parts.join(' - ')
}

function buildHotelText(rows: KyowontourScheduleRowParsed[]): string | null {
  const hotels = rows
    .filter((r) => r.type === '호텔' && stripScheduleNameKo(r.nameKo))
    .map((r) => stripScheduleNameKo(r.nameKo))
  if (hotels.length === 0) return null
  return hotels.join(' / ')
}

function scheduleRowsToFactDays(days: RegisterScheduleDay[]): RegisterFactScheduleDay[] {
  return days.map((d) => {
    const places = d.routeText
      ? d.routeText
          .split(/\s*-\s*/)
          .map((x) => x.trim())
          .filter(Boolean)
      : d.title?.trim()
        ? [d.title.trim()]
        : []
    return {
      day: d.day,
      places,
      hotels: d.hotelText?.trim() ? [d.hotelText.trim()] : [],
      meals: [],
      transportNote: null,
    }
  })
}

export function needsKyowontourScheduleCollect(parsed: RegisterParsed): boolean {
  if (parsed.kyowontourScheduleExtractFilled) {
    const rows = parsed.schedule ?? []
    if (rows.length > 0 && scheduleNeedsMealHotelCollect(rows)) return true
    return false
  }
  const rows = parsed.schedule ?? []
  if (rows.length === 0) return true
  if (scheduleNeedsMealHotelCollect(rows)) return true
  return rows.every((d) => !d.title?.trim() && !d.description?.trim())
}

export function scheduleTabParsedToRegisterDays(parsed: KyowontourScheduleTabParsed): RegisterScheduleDay[] {
  if (parsed.rows.length === 0) return []
  const byDay = new Map<number, KyowontourScheduleRowParsed[]>()
  for (const row of parsed.rows) {
    const list = byDay.get(row.day) ?? []
    list.push(row)
    byDay.set(row.day, list)
  }
  const mealByDay = new Map(parsed.meals.map((m) => [m.day, m]))
  const days = [...byDay.keys()].sort((a, b) => a - b)
  const out: RegisterScheduleDay[] = []

  for (const day of days) {
    const rows = byDay.get(day) ?? []
    const title = pickDayTitle(rows, day)
    const routeText = buildRouteText(rows)
    const hotelText = buildHotelText(rows)
    const meal = mealByDay.get(day)
    const mealEnriched = enrichScheduleMealFieldsFromText(
      {
        breakfastText: isEmptyMealHotelField(meal?.breakfast) ? null : meal?.breakfast ?? null,
        lunchText: isEmptyMealHotelField(meal?.lunch) ? null : meal?.lunch ?? null,
        dinnerText: isEmptyMealHotelField(meal?.dinner) ? null : meal?.dinner ?? null,
        mealSummaryText: meal
          ? [meal.breakfast, meal.lunch, meal.dinner]
              .filter((x) => !isEmptyMealHotelField(x))
              .join(' / ') || null
          : null,
      },
      [],
    )
    out.push({
      day,
      title: title || `${day}일차`,
      description: routeText || title || `${day}일차`,
      routeText,
      imageKeyword: '',
      imageKeyword2: null,
      hotelText,
      breakfastText: mealEnriched.breakfastText ?? null,
      lunchText: mealEnriched.lunchText ?? null,
      dinnerText: mealEnriched.dinnerText ?? null,
      mealSummaryText: mealEnriched.mealSummaryText ?? null,
    })
  }
  const expressed = kyowontourFactDaysToRegisterSchedule(scheduleRowsToFactDays(out)).map((d) => {
    const src = out.find((x) => x.day === d.day)
    if (!src) return d
    return {
      ...d,
      breakfastText: src.breakfastText ?? d.breakfastText,
      lunchText: src.lunchText ?? d.lunchText,
      dinnerText: src.dinnerText ?? d.dinnerText,
      mealSummaryText: src.mealSummaryText ?? d.mealSummaryText,
      hotelText: src.hotelText ?? d.hotelText,
    }
  })
  return applyKyowontourScheduleImageKeywordsToRows(expressed, {
    productTitle: undefined,
    productDestination: undefined,
  })
}

export function applyKyowontourScheduleCollectToParsed(
  parsed: RegisterParsed,
  scheduleDays: RegisterScheduleDay[],
  summary: string,
): RegisterParsed {
  const notes = [...(parsed.registerPreviewPolicyNotes ?? [])]
  const note = `교원이지 여행일정표: ${summary} (tourEventTabData goodsEvtTab_2)`
  if (!notes.includes(note)) notes.push(note)
  const merged = mergeScheduleDaysPreservingExpressionMergingMealHotel(parsed.schedule ?? [], scheduleDays)
  const withKeywords = applyKyowontourScheduleImageKeywordsToRows(merged, {
    productTitle: parsed.title,
    productDestination: parsed.destination,
  })
  return {
    ...parsed,
    schedule: withKeywords,
    kyowontourScheduleCollectRan: true,
    kyowontourScheduleCollectSummary: summary,
    registerPreviewPolicyNotes: notes,
  }
}
