/**
 * 자유여행 등록 미리보기 UI — Fit JSON → 일차 schedule (클라이언트 번들 전용, 서버 모듈 import 금지).
 */
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-ybtour'
import {
  fitGeminiResponseToKeywordDays,
  parseFitItineraryGeminiJson,
} from '@/lib/fit-itinerary-gemini-parse'
import { mergeScheduleWithFitKeywords } from '@/lib/fit-itinerary-merge-schedule-keywords'
import type { FitDayImageKeywordFallbackContext } from '@/lib/fit-itinerary-pick-day-image-keyword'
import type { ProductScheduleJsonRow } from '@/lib/schedule-image-keyword-persist'

function registerRowsToScheduleJsonRows(rows: RegisterScheduleDay[]): ProductScheduleJsonRow[] {
  return rows.map((r) => ({
    day: r.day,
    title: r.title ?? null,
    description: r.description ?? null,
    routeText: r.routeText ?? null,
    imageKeyword: r.imageKeyword ?? null,
    imageKeyword2: r.imageKeyword2 ?? null,
  }))
}

function scheduleJsonRowsToRegisterRows(rows: ProductScheduleJsonRow[]): RegisterScheduleDay[] {
  return rows.map((r) => ({
    day: Math.floor(Number(r.day)),
    title: String(r.title ?? '').trim() || `Day ${r.day}`,
    description: String(r.description ?? '').trim(),
    routeText: typeof r.routeText === 'string' ? r.routeText : null,
    imageKeyword: String(r.imageKeyword ?? '').trim(),
    imageKeyword2:
      r.imageKeyword2 != null && String(r.imageKeyword2).trim()
        ? String(r.imageKeyword2).trim()
        : null,
  }))
}

function fallbackCtxFromRegisterParsed(parsed: RegisterParsed): FitDayImageKeywordFallbackContext {
  const cityNameKo =
    parsed.primaryDestination?.trim() || parsed.destination?.trim() || ''
  return {
    cityNameKo,
    cityKey: '',
    productTitle: parsed.title ?? '',
    primaryDestination: parsed.primaryDestination,
    destination: parsed.destination,
  }
}

function scheduleRowsFromFitDays(
  parsed: RegisterParsed,
  fitDays: ReturnType<typeof fitGeminiResponseToKeywordDays>,
): RegisterScheduleDay[] {
  const existing = registerRowsToScheduleJsonRows(parsed.schedule ?? [])
  const existingByDay = new Map(existing.map((r) => [Math.floor(Number(r.day)), r]))
  const fallbackCtx = fallbackCtxFromRegisterParsed(parsed)
  const { rows } = mergeScheduleWithFitKeywords([], fitDays, fallbackCtx)
  const merged = rows.map((row) => {
    const day = Math.floor(Number(row.day))
    const prev = existingByDay.get(day)
    if (!prev) return row
    return {
      ...prev,
      day: row.day,
      title: String(row.title ?? '').trim() || String(prev.title ?? '').trim() || `Day ${row.day}`,
      description: String(row.description ?? '').trim() || String(prev.description ?? '').trim(),
      imageKeyword: row.imageKeyword,
      imageKeyword2: row.imageKeyword2 ?? prev.imageKeyword2,
    }
  })
  return scheduleJsonRowsToRegisterRows(merged)
}

/** 미리보기 UI — parsed.schedule 이 비었거나 키워드가 통일됐을 때 Fit JSON으로 일차 행 복구 */
export function buildAirtelRegisterScheduleRowsFromFitParsed(
  parsed: RegisterParsed | null | undefined,
): RegisterScheduleDay[] | null {
  if (!parsed) return null
  const json = parsed.registerFitItineraryGeminiJson?.trim()
  if (!json) return null
  try {
    const response = parseFitItineraryGeminiJson(json, 'register-ui-fit-schedule')
    const fitDays = fitGeminiResponseToKeywordDays(response)
    if (!fitDays.length) return null
    const schedule = scheduleRowsFromFitDays(parsed, fitDays)
    return schedule.length > 0 ? schedule : null
  } catch {
    return null
  }
}
