/**
 * 항공+호텔(자유여행) — admin preview ItineraryDay 초안.
 * SSOT: 관리자 travelScope=air_hotel_free 선택 + registerFitItineraryGeminiJson(Fit 예시일정).
 */
import { parseFitItineraryGeminiJson } from '@/lib/fit-itinerary-gemini-parse'
import { registerScheduleToDayInputs } from '@/lib/upsert-itinerary-days-modetour'
import type { RegisterPreviewItineraryDay } from '@/lib/register-preview-payload-modetour'

function formatActivityLine(act: {
  title?: string
  description?: string
  estimatedCostKrw?: number | null
  estimatedCostNote?: string | null
  transportMode?: string | null
  transportDuration?: string | null
}): string {
  const parts: string[] = []
  const title = String(act.title ?? '').trim()
  const desc = String(act.description ?? '').trim()
  if (title) parts.push(title)
  if (desc && desc !== title) parts.push(desc)
  const cost =
    act.estimatedCostKrw != null && act.estimatedCostKrw > 0
      ? `약 ${act.estimatedCostKrw.toLocaleString('ko-KR')}원`
      : String(act.estimatedCostNote ?? '').trim()
  if (cost) parts.push(cost)
  const transport = [act.transportMode, act.transportDuration].map((x) => String(x ?? '').trim()).filter(Boolean)
  if (transport.length) parts.push(transport.join(' '))
  return parts.join(' · ')
}

/** Fit JSON + routeText schedule → 미리보기 ItineraryDay (이동·비용·먹거리 포함) */
export function buildRegisterAirHotelItineraryDayDrafts(parsed: {
  registerFitItineraryGeminiJson?: string | null
  schedule?: Array<{
    day?: number
    title?: string
    description?: string
    routeText?: string | null
    hotelText?: string | null
    breakfastText?: string | null
    lunchText?: string | null
    dinnerText?: string | null
    mealSummaryText?: string | null
  }> | null
}): RegisterPreviewItineraryDay[] {
  const json = parsed.registerFitItineraryGeminiJson?.trim()
  if (!json) {
    return registerScheduleToDayInputs(parsed.schedule ?? [])
  }

  try {
    const fit = parseFitItineraryGeminiJson(json, 'register-air-hotel-itinerary')
    const schedByDay = new Map((parsed.schedule ?? []).map((r) => [Number(r.day), r]))

    return fit.days.map((day) => {
      const sched = schedByDay.get(day.dayNumber)
      const routeText = String(sched?.routeText ?? '').trim() || null
      const activities = [...(day.activities ?? [])].sort((a, b) => a.order - b.order)
      const activityBlock = activities.map(formatActivityLine).filter(Boolean).join('\n')
      const summaryTextRaw = [String(day.summary ?? '').trim(), activityBlock].filter(Boolean).join('\n\n') || null

      const mealFromFit = activities
        .filter((a) => a.category === 'meal')
        .map(formatActivityLine)
        .filter(Boolean)
        .join(' / ')
      const mealFromSched = [sched?.breakfastText, sched?.lunchText, sched?.dinnerText, sched?.mealSummaryText]
        .map((x) => String(x ?? '').trim())
        .filter(Boolean)
        .join(' / ')

      return {
        day: day.dayNumber,
        city: routeText ?? day.dayCityKey ?? null,
        summaryTextRaw,
        poiNamesRaw: routeText,
        meals: mealFromFit || mealFromSched || null,
        accommodation: String(sched?.hotelText ?? '').trim() || null,
        hotelText: String(sched?.hotelText ?? '').trim() || null,
        breakfastText: sched?.breakfastText ?? null,
        lunchText: sched?.lunchText ?? null,
        dinnerText: sched?.dinnerText ?? null,
        mealSummaryText: sched?.mealSummaryText ?? null,
        transport: activities
          .filter((a) => a.category === 'transport')
          .map(formatActivityLine)
          .filter(Boolean)
          .join(' / ') || null,
      }
    })
  } catch {
    return registerScheduleToDayInputs(parsed.schedule ?? [])
  }
}
