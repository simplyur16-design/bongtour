/**
 * 참좋은여행 등록 파이프: 일정 표현층만 보정.
 * @see docs/register_schedule_expression_ssot.md
 */
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'
import { stripCounselingTermsFromScheduleRow } from '@/lib/itinerary-counseling-terms-strip'
import {
  coerceScheduleDayToOneBased,
  normalizeDay,
  registerScheduleToDayInputs,
  type ItineraryDayInput,
} from '@/lib/upsert-itinerary-days-verygoodtour'

const DAY_N_TRAVEL_RE = /^day\s*\d+\s*travel$/i

function isPlaceholderHotel(ht: string): boolean {
  const t = ht.trim()
  return !t || t === '-' || t === '—' || t === '–'
}

/** 공용 기본 imageKeyword `Day N travel` 제거·대체 (title → description → 빈 문자열) */
export function sanitizeVerygoodtourScheduleRowExpression(row: RegisterScheduleDay): RegisterScheduleDay {
  const kw = String(row.imageKeyword ?? '').trim()
  if (!DAY_N_TRAVEL_RE.test(kw)) return row
  const fromTitle = String(row.title ?? '').trim().slice(0, 120)
  const fromDesc = String(row.description ?? '').trim().slice(0, 120)
  const nextKw = fromTitle || fromDesc ? (fromTitle || fromDesc).slice(0, 120) : ''
  return { ...row, imageKeyword: nextKw }
}

export function augmentVerygoodtourScheduleExpressionParsed(parsed: RegisterParsed): RegisterParsed {
  const sched = parsed.schedule
  if (!sched?.length) return parsed
  return {
    ...parsed,
    schedule: sched.map((r) => {
      const base = sanitizeVerygoodtourScheduleRowExpression(stripCounselingTermsFromScheduleRow(r))
      const d = coerceScheduleDayToOneBased(base.day) ?? normalizeDay(base.day)
      return d != null && d >= 1 ? { ...base, day: d } : base
    }),
  }
}

/**
 * `parsed.schedule`를 ItineraryDay 초안의 단일 소스로 삼고, hotelText가 있으면 accommodation을 맞춘다.
 * schedule이 비어 있으면 기존 drafts를 그대로 둔다.
 */
export function finalizeVerygoodtourItineraryDayDraftsFromSchedule(
  _drafts: ItineraryDayInput[],
  schedule: RegisterScheduleDay[]
): ItineraryDayInput[] {
  if (!schedule?.length) return _drafts
  const fromSchedule = registerScheduleToDayInputs(schedule.map(stripCounselingTermsFromScheduleRow))
  return fromSchedule.map((d) => {
    const ht = d.hotelText?.trim()
    if (isPlaceholderHotel(ht ?? '')) return d
    return { ...d, accommodation: ht!.slice(0, 500) }
  })
}

/** confirm: 가격/항공만이 아니라 일정 표현층(일차 행 또는 실질 draft)이 있어야 함 */
export function verygoodConfirmHasScheduleExpressionLayer(
  parsed: RegisterParsed,
  drafts: ItineraryDayInput[]
): boolean {
  if ((parsed.schedule?.length ?? 0) > 0) return true
  return drafts.some((d) => {
    const s = String(d.summaryTextRaw ?? '').trim()
    if (s.length >= 8) return true
    const ht = d.hotelText?.trim()
    if (ht && !isPlaceholderHotel(ht)) return true
    const m = String(d.meals ?? '').trim()
    if (m.length > 0) return true
    return false
  })
}
