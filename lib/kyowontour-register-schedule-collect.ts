/**
 * 교원이지 등록 — goodsEvtTab_2 AJAX로 여행일정표 자동 수집.
 * 붙여넣기·LLM 일정이 비어 있을 때만 보강(운영자 입력 SSOT 우선).
 *
 * REGRESSION-FREEZE[kyowontour-tour-event-tab-opt-shop]: schedule collect mapping — manifest
 */
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-kyowontour'
import type { KyowontourScheduleRowParsed, KyowontourScheduleTabParsed } from '@/lib/kyowontour-tour-event-tab-data'
import { polishKyowontourImageKeyword, applyKyowontourScheduleImageKeywordsToRows } from '@/lib/kyowontour-schedule-image-keyword'
import {
  mergeScheduleDaysPreservingExpressionMergingMealHotel,
  scheduleNeedsMealHotelCollect,
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

function buildDescription(rows: KyowontourScheduleRowParsed[]): string {
  const lines = rows
    .filter(scheduleRowLooksMeaningful)
    .map((r) => {
      const name = stripScheduleNameKo(r.nameKo)
      if (!name) return ''
      if (r.duration) return `${name} (${r.duration})`
      return name
    })
    .filter(Boolean)
  return lines.join('\n')
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
    const description = buildDescription(rows)
    const routeText = buildRouteText(rows)
    const hotelText = buildHotelText(rows)
    const meal = mealByDay.get(day)
    const mealEnriched = enrichScheduleMealFieldsFromText(
      {
        breakfastText: meal?.breakfast ?? null,
        lunchText: meal?.lunch ?? null,
        dinnerText: meal?.dinner ?? null,
        mealSummaryText: meal
          ? [meal.breakfast, meal.lunch, meal.dinner].filter(Boolean).join(' / ') || null
          : null,
      },
      [description],
    )
    const ctx = { day, title, description }
    const imageKeyword = polishKyowontourImageKeyword(title || routeText || description.slice(0, 40), ctx)
    out.push({
      day,
      title: title || `${day}일차`,
      description: description || title || `${day}일차`,
      routeText,
      imageKeyword,
      hotelText,
      breakfastText: mealEnriched.breakfastText ?? null,
      lunchText: mealEnriched.lunchText ?? null,
      dinnerText: mealEnriched.dinnerText ?? null,
      mealSummaryText: mealEnriched.mealSummaryText ?? null,
    })
  }
  return applyKyowontourScheduleImageKeywordsToRows(out, {
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
