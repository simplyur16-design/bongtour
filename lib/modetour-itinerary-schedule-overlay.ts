/**
 * 확정(confirm) 시 붙여넣기 `parsed.schedule`과 스크래핑 ItineraryDay 초안을 일차별 병합.
 * @see parse-and-register-modetour-handler.ts confirm 경로
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-modetour'
import { extractModetourMealSummaryFromScheduleDescription } from '@/lib/register-modetour-meal-from-description'
import { registerScheduleToDayInputs } from '@/lib/upsert-itinerary-days-modetour'

/** ItineraryDay: 일정표 schedule.hotelText(본문 추출) → 그다음 초안 hotelText → accommodation 보정 */
export function modetourItineraryDraftsApplyScheduleHotelBodyFirst(
  drafts: ReturnType<typeof registerScheduleToDayInputs>,
  schedule: Array<{ day?: number; hotelText?: string | null }>
): ReturnType<typeof registerScheduleToDayInputs> {
  const bodyByDay = new Map<number, string>()
  for (const s of schedule) {
    const day = Number(s.day)
    if (!Number.isInteger(day) || day < 1) continue
    const ht = typeof s.hotelText === 'string' ? s.hotelText.trim() : ''
    if (!ht || ht === '-' || ht === '—' || ht === '–') continue
    bodyByDay.set(day, ht.slice(0, 500))
  }
  return drafts.map((d) => {
    const fromBody = bodyByDay.get(d.day)
    const mergedHt = fromBody ?? (d.hotelText?.trim() || '')
    const htNorm =
      mergedHt && mergedHt !== '-' && mergedHt !== '—' && mergedHt !== '–' ? mergedHt.slice(0, 500) : null
    return {
      ...d,
      hotelText: htNorm,
      accommodation: htNorm ?? (d.accommodation?.trim() || null),
    }
  })
}

/**
 * 붙여넣기 파이프로 정제된 `parsed.schedule`과 동일한 요약·식사·rawBlock을 일차별로 덮어쓴다.
 * (숙소는 `modetourItineraryDraftsApplyScheduleHotelBodyFirst`가 schedule 기준으로 이미 맞춤.)
 * 요약이 매우 짧아도 식사·숙소 필드는 항상 병합(예전: 짧은 요약에서 통째로 return d 하면 저장 시 호텔/식사가 사라짐).
 */
export function modetourItineraryDraftsApplyParsedScheduleOverlay(
  drafts: ReturnType<typeof registerScheduleToDayInputs>,
  schedule: NonNullable<RegisterParsed['schedule']>
): ReturnType<typeof registerScheduleToDayInputs> {
  if (!schedule?.length || !drafts.length) return drafts
  const rows = registerScheduleToDayInputs(schedule)
  const byDay = new Map(rows.map((r) => [r.day, r]))
  const schedByDay = new Map(
    schedule
      .map((s) => [Number(s.day), s] as const)
      .filter(([day]) => Number.isInteger(day) && day >= 1)
  )
  return drafts.map((d) => {
    const o = byDay.get(d.day)
    if (!o) return d
    const mergedCity = d.city?.trim() || o.city?.trim() || null
    const mergedPoiNamesRaw = d.poiNamesRaw?.trim() || o.poiNamesRaw?.trim() || null
    const sRow = schedByDay.get(d.day)
    const mealFromDesc = extractModetourMealSummaryFromScheduleDescription(
      typeof sRow?.description === 'string' ? sRow.description : undefined
    )
    const brief = String(o.summaryTextRaw ?? '').trim()
    const hasMeal =
      Boolean(o.breakfastText?.trim()) ||
      Boolean(o.lunchText?.trim()) ||
      Boolean(o.dinnerText?.trim()) ||
      Boolean(o.mealSummaryText?.trim()) ||
      Boolean(o.meals?.trim()) ||
      Boolean(mealFromDesc)
    const hasMealFromDraft =
      Boolean(d.breakfastText?.trim()) ||
      Boolean(d.lunchText?.trim()) ||
      Boolean(d.dinnerText?.trim()) ||
      Boolean(d.mealSummaryText?.trim()) ||
      Boolean(d.meals?.trim())
    const pickMeal = (a: string | null | undefined, b: string | null | undefined) =>
      (a?.trim() || b?.trim() || null) as string | null
    const mergedMeals = o.meals?.trim() || mealFromDesc || d.meals?.trim() || null
    const hotelText = pickMeal(o.hotelText, d.hotelText)
    const mealFields = {
      breakfastText: pickMeal(o.breakfastText, d.breakfastText),
      lunchText: pickMeal(o.lunchText, d.lunchText),
      dinnerText: pickMeal(o.dinnerText, d.dinnerText),
      mealSummaryText: pickMeal(o.mealSummaryText, d.mealSummaryText) ?? mealFromDesc ?? null,
      meals: mergedMeals,
      hotelText,
      accommodation: hotelText ?? (d.accommodation?.trim() || null),
    }
    if (brief.length < 8 && !hasMeal && !hasMealFromDraft) {
      return { ...d, ...mealFields, city: mergedCity, poiNamesRaw: mergedPoiNamesRaw }
    }
    return {
      ...d,
      summaryTextRaw: brief.length >= 8 ? o.summaryTextRaw : d.summaryTextRaw,
      rawBlock: brief.length >= 8 ? (o.rawBlock ?? d.rawBlock) : d.rawBlock,
      ...mealFields,
      city: mergedCity,
      poiNamesRaw: mergedPoiNamesRaw,
    }
  })
}
