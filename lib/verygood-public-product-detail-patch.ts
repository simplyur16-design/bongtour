/**
 * 참좋은여행(verygoodtour) 전용 — 공개 상품 직렬화(TravelProduct) 일정 description 보정 및
 * 일정 카드 호텔 한 줄 계산. 공용 컴포넌트/타입/페이지 merge 로직을 수정하지 않는다.
 */
import type { TravelProduct } from '@/app/components/travel/TravelProductDetail'
import { formatScheduleDayHotelLine } from '@/lib/hotel-meal-display'

function trimOrNull(s: string | null | undefined): string | null {
  if (s == null || typeof s !== 'string') return null
  const t = s.trim()
  return t.length > 0 ? t : null
}

/** 줄바꿈 본문이 ItineraryRouteSummaryLine(쉼표 토큰)에서 읽히도록 쉼표로 이어 붙임 */
export function expandVerygoodScheduleDescriptionForPublicDetail(description: string | null | undefined): string {
  const raw = (description ?? '').replace(/\r/g, '\n').trim()
  if (!raw) return ''
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length <= 1) return raw
  return lines.join(', ')
}

function isPollutedHotelNamesList(names: string[]): boolean {
  if (names.length < 5) return false
  if (names.some((n) => /^\d+일차$/.test(String(n).trim()))) return true
  if (names.some((n) => /호텔\s*투숙\s*및\s*휴식/.test(String(n)))) return true
  const set = new Set(names.map((x) => String(x).trim()))
  if (set.size <= 3) return true
  let maxDup = 0
  const counts = new Map<string, number>()
  for (const n of names) {
    const k = String(n).trim()
    const c = (counts.get(k) ?? 0) + 1
    counts.set(k, c)
    if (c > maxDup) maxDup = c
  }
  if (names.length >= 6 && maxDup >= 3) return true
  return false
}

function isLikelyDomesticReturnArrivalDay(description: string): boolean {
  const t = description.replace(/\r/g, '\n')
  if (!/도착/.test(t)) return false
  if (/호텔\s*투숙|숙박/.test(t)) return false
  if (/\bOZ\d+편\s*인천\s*출발|인천\s*출발|\[.*\]\s*.*인천\s*출발/.test(t)) return false
  if (/(인천국제공항|제\s*\d+\s*터미널|\(T2\)|\bT2\b)/i.test(t) && /도착/.test(t)) return true
  return false
}

export function shouldOmitVerygoodScheduleDayHotelProductFallback(params: {
  dayHotelText: string | null | undefined
  isLastScheduleRow: boolean
  dayDescription: string
  hotelNames?: string[] | null
  hotelSummaryText?: string | null
}): boolean {
  const day = trimOrNull(params.dayHotelText)
  if (day) return false

  const names = (params.hotelNames ?? [])
    .map((x) => String(x).trim())
    .filter((x) => x.length > 0)
  const desc = (params.dayDescription ?? '').replace(/\r/g, '\n')
  const summary = trimOrNull(params.hotelSummaryText)
  const isLast = params.isLastScheduleRow

  if (names.length > 0 && isPollutedHotelNamesList(names)) return true

  if (isLast && summary && /미정\s*입니다/.test(summary) && /\s외\s*\d+\s*$/.test(summary)) return true

  if (isLast && desc.trim().length > 0 && isLikelyDomesticReturnArrivalDay(desc)) return true

  return false
}

/** 공개 상세 verygood 전용: schedule.description만 확장(호텔 판단은 렌더 전용 compute에서). */
export function tryApplyVerygoodPublicProductSerializedPatch(moduleKey: string, product: TravelProduct): TravelProduct {
  if (moduleKey !== 'verygoodtour') return product
  const schedule = product.schedule
  if (!schedule?.length) return product
  return {
    ...product,
    schedule: schedule.map((s) => ({
      ...s,
      description: expandVerygoodScheduleDescriptionForPublicDetail(s.description),
    })),
  }
}

export function computeVerygoodPublicDayHotelLine(args: {
  hotelNames: string[] | null | undefined
  hotelSummaryText: string | null | undefined
  dayHotelText: string | null | undefined
  isLastScheduleRow: boolean
  dayDescription: string
}): string | null {
  if (
    shouldOmitVerygoodScheduleDayHotelProductFallback({
      dayHotelText: args.dayHotelText,
      isLastScheduleRow: args.isLastScheduleRow,
      dayDescription: args.dayDescription,
      hotelNames: args.hotelNames,
      hotelSummaryText: args.hotelSummaryText,
    })
  )
    return null
  return formatScheduleDayHotelLine({
    hotelNames: args.hotelNames ?? null,
    hotelSummaryText: args.hotelSummaryText ?? null,
    dayHotelText: args.dayHotelText ?? null,
  })
}
