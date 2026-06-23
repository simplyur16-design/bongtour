/**
 * modetour(모두투어) 등록 — parsed.schedule → ItineraryDay 초안 확정.
 */
import { stripCounselingTermsFromScheduleRow } from '@/lib/itinerary-counseling-terms-strip'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-modetour'
import {
  registerScheduleToDayInputs,
  type ItineraryDayInput,
} from '@/lib/upsert-itinerary-days-modetour'

function isModetourPlaceholderHotel(ht: string): boolean {
  const t = ht.trim()
  if (!t || t === '-' || t === '—' || t === '–') return true
  if (/^예정\s*호텔\(출발\s*전\s*확정\)$/i.test(t)) return false
  return false
}

/**
 * `parsed.schedule`를 ItineraryDay 초안의 단일 소스로 삼고, hotelText가 있으면 accommodation을 맞춘다.
 */
export function finalizeModetourItineraryDayDraftsFromSchedule(
  _drafts: ItineraryDayInput[],
  schedule: RegisterScheduleDay[],
): ItineraryDayInput[] {
  if (!schedule?.length) return _drafts
  const fromSchedule = registerScheduleToDayInputs(schedule.map(stripCounselingTermsFromScheduleRow))
  return fromSchedule.map((d) => {
    const ht = d.hotelText?.trim()
    if (!ht || isModetourPlaceholderHotel(ht)) return d
    return { ...d, accommodation: ht.slice(0, 500) }
  })
}
