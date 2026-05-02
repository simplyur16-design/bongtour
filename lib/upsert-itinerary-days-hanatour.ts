/**
 * ItineraryDay: 하나투어 등록/저장 경로용 — 공급사 원문 일정표 정본(raw/source-of-truth) 계층.
 * (productId, day) 기준. 일정 전체 재저장 시 기존 row 삭제 후 createMany.
 * 정책: docs/itinerary-policy.md
 */
import type { PrismaClient } from '@prisma/client'

/** 일차 1건 입력. 있는 값만 넣고 나머지는 null 허용. */
export type ItineraryDayInput = {
  day: number
  dateText?: string | null
  city?: string | null
  summaryTextRaw?: string | null
  poiNamesRaw?: string | null
  meals?: string | null
  accommodation?: string | null
  hotelText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
  mealSummaryText?: string | null
  transport?: string | null
  notes?: string | null
  rawBlock?: string | null
}

const MAX_TEXT = 2000

function trimNull(s: string | null | undefined): string | null {
  if (s == null) return null
  const t = String(s).trim()
  return t ? t.slice(0, MAX_TEXT) : null
}

/**
 * day를 1 이상의 정수로 정규화. 잘못된 값이면 null.
 */
export function normalizeDay(day: unknown): number | null {
  if (day == null) return null
  const n = Number(day)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}

/**
 * 일정 배열을 ItineraryDay로 적재.
 * - 빈 배열이면 스킵.
 * - 기존 해당 productId의 ItineraryDay 전부 삭제 후 createMany로 재적재 (중복/꼬임 방지).
 * - day 정규화 실패한 항목은 스킵.
 */
export async function upsertItineraryDays(
  prisma: PrismaClient,
  productId: string,
  days: ItineraryDayInput[]
): Promise<void> {
  if (!days?.length) return

  const valid = days
    .map((d) => {
      const day = normalizeDay(d.day)
      if (day == null) return null
      return {
        productId,
        day,
        dateText: trimNull(d.dateText),
        city: trimNull(d.city),
        summaryTextRaw: trimNull(d.summaryTextRaw),
        poiNamesRaw: trimNull(d.poiNamesRaw),
        meals: trimNull(d.meals),
        accommodation: trimNull(d.accommodation),
        hotelText: trimNull(d.hotelText),
        breakfastText: trimNull(d.breakfastText),
        lunchText: trimNull(d.lunchText),
        dinnerText: trimNull(d.dinnerText),
        mealSummaryText: trimNull(d.mealSummaryText),
        transport: trimNull(d.transport),
        notes: trimNull(d.notes),
        rawBlock: d.rawBlock != null && String(d.rawBlock).trim() ? String(d.rawBlock).trim().slice(0, MAX_TEXT * 2) : null,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (valid.length === 0) return

  await prisma.itineraryDay.deleteMany({ where: { productId } })
  await prisma.itineraryDay.createMany({ data: valid })
}

/**
 * RegisterScheduleDay[] → ItineraryDayInput[].
 * register-parse: day, title, description, imageKeyword. 원문 보존을 위해 summaryTextRaw = description, rawBlock = 원문 블록.
 */
export function registerScheduleToDayInputs(
  schedule: Array<{
    day?: number
    title?: string
    description?: string
    imageKeyword?: string
    routeText?: string | null
    hotelText?: string | null
    breakfastText?: string | null
    lunchText?: string | null
    dinnerText?: string | null
    mealSummaryText?: string | null
  }>
): ItineraryDayInput[] {
  if (!schedule?.length) return []
  return schedule.flatMap((s): ItineraryDayInput[] => {
    const day = normalizeDay(s.day) ?? 0
    if (day < 1) return []
    const title = String(s.title ?? '').trim()
    const description = String(s.description ?? '').trim()
    const imageKeyword = String((s as { imageKeyword?: string }).imageKeyword ?? '').trim()
    const routeText = String((s as { routeText?: string | null }).routeText ?? '').trim()
    const summaryTextRaw = description || title || null
    const rawBlock =
      title || description || imageKeyword || routeText
        ? JSON.stringify({
            title,
            description,
            imageKeyword,
            ...(routeText ? { routeText } : {}),
          })
        : null
    const hotelText = trimNull(s.hotelText)
    const breakfastText = trimNull(s.breakfastText)
    const lunchText = trimNull(s.lunchText)
    const dinnerText = trimNull(s.dinnerText)
    const mealSummaryText = trimNull(s.mealSummaryText)
    const mealLine = [breakfastText, lunchText, dinnerText].filter(Boolean).join(' / ')
    const mealsLegacy = trimNull(mealLine || mealSummaryText || undefined)
    return [
      {
        day,
        city: routeText || title || null,
        poiNamesRaw: routeText || null,
        summaryTextRaw: summaryTextRaw || null,
        rawBlock,
        hotelText,
        breakfastText,
        lunchText,
        dinnerText,
        mealSummaryText,
        meals: mealsLegacy,
      },
    ]
  })
}

/**
 * ParsedItinerary[] (day, description) → ItineraryDayInput[].
 * travel-parse / parse-and-upsert / admin/products.
 */
export function parsedItinerariesToDayInputs(
  itineraries: Array<{ day?: number; description?: string }>
): ItineraryDayInput[] {
  if (!itineraries?.length) return []
  return itineraries.flatMap((i): ItineraryDayInput[] => {
    const day = normalizeDay(i.day) ?? 0
    if (day < 1) return []
    const summaryTextRaw = trimNull(i.description)
    return [{ day, summaryTextRaw: summaryTextRaw || null }]
  })
}

/**
 * ExtractedItineraryDay[] (day, title, items) → ItineraryDayInput[].
 * mapToParsedProduct 경로: title = 해당 일 요약, items = 방문지 나열 → summaryTextRaw / poiNamesRaw.
 */
export function extractedItineraryToDayInputs(
  itinerary: Array<{ day?: number; title?: string; items?: string[] }>
): ItineraryDayInput[] {
  if (!itinerary?.length) return []
  return itinerary.flatMap((d): ItineraryDayInput[] => {
    const day = normalizeDay(d.day) ?? 0
    if (day < 1) return []
    const title = String(d.title ?? '').trim()
    const items = Array.isArray(d.items) ? d.items.map((x) => String(x).trim()).filter(Boolean) : []
    const summaryTextRaw = title || null
    const poiNamesRaw = items.length ? items.join(', ') : null
    const rawBlock = title || items.length ? JSON.stringify({ title, items }) : null
    return [{ day, summaryTextRaw, poiNamesRaw, rawBlock: rawBlock || null }]
  })
}
