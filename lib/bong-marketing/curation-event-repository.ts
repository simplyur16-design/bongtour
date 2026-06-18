import { prisma } from '@/lib/prisma'
import { countryLabelsMatch } from '@/lib/bong-marketing/global-event-collector'
import type { GlobalEventDescriptor } from '@/lib/bong-marketing/global-event-collector'

export type CurationEventSource = 'curation_event' | 'bong_global_event'

export interface CurationEventDto {
  name: string
  countryCode: string
  city: string | null
  startMonth: number
  startDay: number | null
  endMonth: number
  endDay: number | null
  type: string
  description: string | null
  appealReason: string | null
  source: CurationEventSource
}

/** PR (가)-3 dual-read — calendar month vs event span (연말 걸침 포함) */
export function monthOverlapsEvent(month: number, startMonth: number, endMonth: number): boolean {
  if (month < 1 || month > 12) return false
  if (startMonth <= endMonth) return month >= startMonth && month <= endMonth
  return month >= startMonth || month <= endMonth
}

function filterByMonthAndCountry<T extends { startMonth: number; endMonth: number; countryLabel: string }>(
  rows: T[],
  month: number,
  country?: string,
): T[] {
  return rows.filter((row) => {
    if (!monthOverlapsEvent(month, row.startMonth, row.endMonth)) return false
    if (country && !countryLabelsMatch(country, row.countryLabel)) return false
    return true
  })
}

function toDtoFromCurationEvent(row: {
  name: string
  countryCode: string
  city: string | null
  startMonth: number
  startDay: number | null
  endMonth: number
  endDay: number | null
  type: string
  description: string | null
  appealReason: string | null
}): CurationEventDto {
  return {
    name: row.name,
    countryCode: row.countryCode,
    city: row.city,
    startMonth: row.startMonth,
    startDay: row.startDay,
    endMonth: row.endMonth,
    endDay: row.endDay,
    type: row.type,
    description: row.description,
    appealReason: row.appealReason,
    source: 'curation_event',
  }
}

function toDtoFromLegacyEvent(row: {
  name: string
  country: string
  city: string | null
  startMonth: number
  startDay: number | null
  endMonth: number
  endDay: number | null
  type: string
  description: string | null
  appealReason: string | null
}): CurationEventDto {
  return {
    name: row.name,
    countryCode: row.country,
    city: row.city,
    startMonth: row.startMonth,
    startDay: row.startDay,
    endMonth: row.endMonth,
    endDay: row.endDay,
    type: row.type,
    description: row.description,
    appealReason: row.appealReason,
    source: 'bong_global_event',
  }
}

async function loadCurationEventsForYear(year: number) {
  return prisma.curationEvent.findMany({
    where: { year },
    orderBy: [{ startMonth: 'asc' }, { startDay: 'asc' }],
  })
}

async function loadLegacyGlobalEventsForYear(year: number) {
  return prisma.bongGlobalEvent.findMany({
    where: { year },
    orderBy: [{ startMonth: 'asc' }, { startDay: 'asc' }],
  })
}

/**
 * 신규 CurationEvent 우선 — 해당 월·국가에 1건이라도 있으면 legacy는 조회하지 않음.
 */
export async function getEventsForRecommendationMonth(
  month: number,
  country?: string,
): Promise<CurationEventDto[]> {
  if (month < 1 || month > 12) return []

  const year = new Date().getFullYear()
  const curationRows = await loadCurationEventsForYear(year)
  const matchedNew = filterByMonthAndCountry(
    curationRows.map((r) => ({ ...r, countryLabel: r.countryCode })),
    month,
    country,
  )

  if (matchedNew.length > 0) {
    return matchedNew.map(toDtoFromCurationEvent)
  }

  const legacyRows = await loadLegacyGlobalEventsForYear(year)
  const matchedLegacy = filterByMonthAndCountry(
    legacyRows.map((r) => ({ ...r, countryLabel: r.country })),
    month,
    country,
  )
  return matchedLegacy.map(toDtoFromLegacyEvent)
}

/** trip-recommender 호환 — GlobalEventDescriptor 형태 */
export async function getGlobalEventsForRecommendationMonth(
  month: number,
  country?: string,
): Promise<GlobalEventDescriptor[]> {
  const events = await getEventsForRecommendationMonth(month, country)
  return events.map((e) => ({
    name: e.name,
    country: e.countryCode,
    city: e.city ?? undefined,
    description: e.description ?? undefined,
    appealReason: e.appealReason ?? undefined,
    source: 'global' as const,
  }))
}

/** 월 범위 문자열 — CurationEvent pool 우선, 없으면 legacy fallback (월별) */
export async function getEventsForRecommendationMonthRange(
  monthRange: string,
  country?: string,
): Promise<CurationEventDto[]> {
  const { parseMonthsFromMonthRange } = await import('@/lib/bong-marketing/seasonal-event-collector')
  const months = parseMonthsFromMonthRange(monthRange)
  if (!months.length) return []

  const seen = new Set<string>()
  const merged: CurationEventDto[] = []

  for (const month of months) {
    const events = await getEventsForRecommendationMonth(month, country)
    for (const event of events) {
      const key = `${event.name}::${event.countryCode}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(event)
    }
  }

  return merged.slice(0, 5)
}
