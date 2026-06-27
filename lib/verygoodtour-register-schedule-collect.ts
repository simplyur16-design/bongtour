/**
 * 참좋은여행 등록 — PackageDetail HTML 일정표 자동 수집.
 * routeText(a–g)·description(동선+분위기)·imageKeyword 슬롯.
 *
 * REGRESSION-FREEZE[verygoodtour-register-schedule-collect]: manifest
 */
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import {
  applyVerygoodScheduleExpressionToRows,
  verygoodFactDaysToRegisterSchedule,
} from '@/lib/verygoodtour-register-api-schedule'
import {
  htmlToVerygoodItineraryPlainText,
  parseVerygoodItineraryFromDetailHtml,
} from '@/lib/verygoodtour-itinerary-collector'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import type { ItineraryDayInput } from '@/lib/upsert-itinerary-days-verygoodtour'
import { extractVerygoodScheduleRowsFromPasteBody } from '@/lib/verygoodtour-schedule-blocks-from-paste'

function itineraryDaysToFactDays(days: ItineraryDayInput[]): RegisterFactScheduleDay[] {
  return days.map((d) => {
    const routeParts = d.poiNamesRaw?.trim()
      ? d.poiNamesRaw
          .split(/\s*-\s*/)
          .map((x) => x.trim())
          .filter(Boolean)
      : []
    const places =
      routeParts.length > 0
        ? routeParts
        : [
            ...(d.city?.trim() ? [d.city.trim()] : []),
            ...(d.poiNamesRaw?.trim() ? [d.poiNamesRaw.trim()] : []),
          ]
    return {
      day: d.day,
      places,
      hotels: d.accommodation?.trim() ? [d.accommodation.trim()] : [],
      meals: d.meals?.trim() ? [d.meals.trim()] : [],
      transportNote: d.transport?.trim() || null,
    }
  })
}

export function needsVerygoodtourScheduleCollect(parsed: RegisterParsed): boolean {
  const rows = parsed.schedule ?? []
  if (rows.length === 0) return true
  return rows.every((d) => !d.routeText?.trim() && !d.description?.trim())
}

/** PackageDetail HTML → RegisterScheduleDay[] (표현층 + imageKeyword). */
export function collectVerygoodtourScheduleDaysFromDetailHtml(
  html: string,
  parsed: RegisterParsed,
): RegisterScheduleDay[] {
  const itinerary = parseVerygoodItineraryFromDetailHtml(html)
  let rows: RegisterScheduleDay[] = []
  if (itinerary.days.length > 0) {
    rows = verygoodFactDaysToRegisterSchedule(itineraryDaysToFactDays(itinerary.days))
  } else {
    const plain = htmlToVerygoodItineraryPlainText(html)
    const extracted = extractVerygoodScheduleRowsFromPasteBody(plain)
    if (extracted.rows.length > 0) {
      rows = applyVerygoodScheduleExpressionToRows(extracted.rows)
    }
  }
  if (rows.length === 0) return []
  return applyRegisterScheduleImageKeywordsBySupplier(rows, {
    supplierKey: 'verygoodtour',
    productDestination: parsed.primaryDestination ?? parsed.destination ?? null,
    productTitle: parsed.title,
  })
}

export function applyVerygoodtourScheduleCollectToParsed(
  parsed: RegisterParsed,
  scheduleDays: RegisterScheduleDay[],
  summary: string,
): RegisterParsed {
  const notes = [...(parsed.registerPreviewPolicyNotes ?? [])]
  const note = `참좋은여행 일정표: ${summary} (PackageDetail HTML)`
  if (!notes.includes(note)) notes.push(note)
  return {
    ...parsed,
    schedule: scheduleDays,
    verygoodtourDetailCollectRan: true,
    verygoodtourDetailCollectSummary: summary,
    registerPreviewPolicyNotes: notes,
  }
}
