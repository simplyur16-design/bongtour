import type { ItineraryDayInput } from '@/lib/upsert-itinerary-days-verygoodtour'
import { normalizeDay } from '@/lib/upsert-itinerary-days-verygoodtour'
import { extractVerygoodScheduleRowsFromPasteBody } from '@/lib/verygoodtour-schedule-blocks-from-paste'
import { applyVerygoodScheduleExpressionToRows } from '@/lib/verygoodtour-register-api-schedule'
import { parseVerygoodScheduleRowsFromDetailHtml } from '@/lib/verygoodtour-register-schedule-item-parse'

export type VerygoodItineraryCollectParams = {
  detailUrl: string
}

export type VerygoodItineraryCollectResult = {
  days: ItineraryDayInput[]
  notes: string[]
}

/** PackageDetail HTML → 붙여넣기와 동일한 `N일차` 평문 (#### 도시 헤더 유지). */
export function htmlToVerygoodItineraryPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<h4[^>]*>/gi, '\n#### ')
    .replace(/<\/h4>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function scheduleRowToItineraryDay(row: {
  day: number
  title: string
  description: string
  routeText?: string | null
  hotelText?: string | null
  mealSummaryText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
}): ItineraryDayInput {
  const meals = [row.breakfastText, row.lunchText, row.dinnerText].filter(Boolean).join(' / ') || row.mealSummaryText
  return {
    day: row.day,
    dateText: null,
    city: row.title?.trim() || null,
    summaryTextRaw: row.description?.trim().slice(0, 500) || null,
    poiNamesRaw: row.routeText?.trim() || null,
    meals: meals?.trim() || null,
    accommodation: row.hotelText?.trim() || null,
    transport: null,
    rawBlock: row.description?.trim().slice(0, 2000) || null,
  }
}

export function parseVerygoodItineraryFromDetailHtml(html: string): VerygoodItineraryCollectResult {
  const notes: string[] = []
  const scheduleRows = parseVerygoodScheduleRowsFromDetailHtml(html)
  if (scheduleRows.length > 0) {
    notes.push(`itinerary scheduleItem panels=${scheduleRows.length}`)
    const byDay = new Map<number, ItineraryDayInput>()
    for (const row of scheduleRows) {
      const day = normalizeDay(Number(row.day))
      if (!day || byDay.has(day)) continue
      byDay.set(day, scheduleRowToItineraryDay(row))
    }
    const days = [...byDay.values()].sort((a, b) => a.day - b.day)
    notes.push(`itinerary parsed days=${days.length}`)
    return { days, notes }
  }

  const plain = htmlToVerygoodItineraryPlainText(html)
  const { rows, log } = extractVerygoodScheduleRowsFromPasteBody(plain)
  notes.push(`itinerary day markers=${log.rawDayBlockCount}`)
  if (rows.length === 0) {
    notes.push('itinerary day blocks not found')
    return { days: [], notes }
  }
  const expressed = applyVerygoodScheduleExpressionToRows(rows)
  const byDay = new Map<number, ItineraryDayInput>()
  for (const row of expressed) {
    const day = normalizeDay(Number(row.day))
    if (!day || byDay.has(day)) continue
    byDay.set(day, scheduleRowToItineraryDay(row))
  }
  const days = [...byDay.values()].sort((a, b) => a.day - b.day)
  notes.push(`itinerary parsed days=${days.length}`)
  return { days, notes }
}

export async function collectVerygoodItineraryInputs(
  params: VerygoodItineraryCollectParams,
): Promise<VerygoodItineraryCollectResult> {
  const notes: string[] = []
  const res = await fetch(params.detailUrl, { method: 'GET' })
  if (!res.ok) return { days: [], notes: [`detail fetch failed: ${res.status}`] }
  const html = await res.text()
  const parsed = parseVerygoodItineraryFromDetailHtml(html)
  return { days: parsed.days, notes: [...notes, ...parsed.notes] }
}
