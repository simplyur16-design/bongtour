/**
 * Fit 예시 일정 Gemini JSON 파싱 — 클라이언트·서버 공용 (node:crypto·prisma 없음).
 */
import { parseLlmJsonObject } from '@/lib/llm-json-extract'
import type { FitItineraryDayForKeyword } from '@/lib/fit-itinerary-pick-day-image-keyword'
import {
  ensureFitDaySummaryTwoSentences,
  ensureFitMasterSummaryTwoSentences,
  extractFitLandmarkHintKoFromActivities,
} from '@/lib/fit-itinerary-summary-two-sentences'

const VALID_PERSONAS = new Set(['mixed', 'couple', 'with-parents', 'with-kids'])
const VALID_CATEGORIES = new Set(['transport', 'hotel', 'meal', 'attraction', 'shopping'])

type GeminiActivity = {
  order: number
  category: 'transport' | 'hotel' | 'meal' | 'attraction' | 'shopping'
  title: string
  description: string
  location: string
  startTime: string
  durationMinutes: number
  estimatedCostKrw: number
  estimatedCostNote: string
  transportMode: string | null
  transportDuration: string | null
}

type GeminiDay = {
  dayNumber: number
  title: string
  summary: string
  dayCityKey: string
  activities: GeminiActivity[]
}

export type FitItineraryGeminiResponse = {
  title: string
  summary: string
  persona: 'mixed' | 'couple' | 'with-parents' | 'with-kids'
  days: GeminiDay[]
}

function parseGeminiJson(text: string, logLabel: string): FitItineraryGeminiResponse {
  const parsed = parseLlmJsonObject<FitItineraryGeminiResponse>(text, {
    logLabel: `fit-itinerary:${logLabel}`,
  })
  if (!parsed?.days?.length) throw new Error('days 배열이 비어 있습니다.')
  if (!VALID_PERSONAS.has(parsed.persona)) {
    throw new Error(`잘못된 persona: ${String(parsed.persona)}`)
  }
  for (const day of parsed.days) {
    for (const act of day.activities ?? []) {
      if (!VALID_CATEGORIES.has(act.category)) {
        throw new Error(`잘못된 category: ${act.category} (day ${day.dayNumber})`)
      }
    }
  }
  return {
    ...parsed,
    summary: ensureFitMasterSummaryTwoSentences(parsed.summary ?? ''),
    days: (parsed.days ?? []).map((day) => ({
      ...day,
      summary: ensureFitDaySummaryTwoSentences(day.summary ?? '', {
        title: day.title,
        landmarkHint: extractFitLandmarkHintKoFromActivities(day.activities ?? []),
      }),
    })),
  }
}

export function parseFitItineraryGeminiJson(text: string, logLabel: string): FitItineraryGeminiResponse {
  return parseGeminiJson(text, logLabel)
}

export function fitGeminiResponseToKeywordDays(
  response: FitItineraryGeminiResponse,
): FitItineraryDayForKeyword[] {
  return (response.days ?? []).map((d) => ({
    dayNumber: d.dayNumber,
    title: d.title,
    summary: d.summary,
    dayCityKey: d.dayCityKey,
    activities: (d.activities ?? []).map((a) => ({
      order: a.order,
      category: a.category,
      title: a.title,
      description: a.description,
      location: a.location,
    })),
  }))
}
