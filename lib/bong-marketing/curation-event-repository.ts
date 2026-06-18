import { prisma } from '@/lib/prisma'
import { countryLabelsMatch } from '@/lib/bong-marketing/global-event-collector'
import type { GlobalEventDescriptor } from '@/lib/bong-marketing/global-event-collector'
import { debugLog } from '@/lib/bong-marketing/debug-log'

export type CurationEventSource = 'curation_event' | 'bong_global_event'

/** PR (가)-7-α — 수집·검토 워크플로 */
export type CurationEventStatus = 'draft' | 'approved' | 'rejected'

export interface EventLookupOptions {
  /** trip-recommender Product.country slug → 한글 라벨 */
  countryLabels?: Record<string, string>
  /** 롤링 추천 월 → 이벤트 year 해석 (기본: now) */
  referenceDate?: Date
}

/** 추천 대상 월이 내년으로 넘어가면 year+1 (예: 6월에 1월 추천 → 다음해 1월) */
export function resolveRecommendationEventYear(
  month: number,
  referenceDate: Date = new Date(),
): number {
  const year = referenceDate.getFullYear()
  const currentMonth = referenceDate.getMonth() + 1
  if (month < 1 || month > 12) return year
  if (month < currentMonth) return year + 1
  return year
}

/**
 * 추천 카드 country(Gemini) ↔ CurationEvent.countryCode(한글/slug) 매칭 후보.
 * slug-only 비교 실패가 🌐 태그 미표시의 주요 원인이었음.
 */
export function buildCountryMatchVariants(
  country: string,
  labelBySlug: Record<string, string> = {},
): string[] {
  const trimmed = country.trim()
  if (!trimmed) return []

  const variants = new Set<string>([trimmed])
  const lower = trimmed.toLowerCase()

  if (labelBySlug[lower]) variants.add(labelBySlug[lower])
  if (labelBySlug[trimmed]) variants.add(labelBySlug[trimmed])

  for (const [slug, label] of Object.entries(labelBySlug)) {
    if (countryLabelsMatch(trimmed, slug) || countryLabelsMatch(trimmed, label)) {
      variants.add(slug)
      variants.add(label)
    }
  }

  return [...variants]
}

function rowMatchesCountry(
  recommendationCountry: string | undefined,
  eventCountryLabel: string,
  labelBySlug: Record<string, string>,
): boolean {
  if (!recommendationCountry?.trim()) return true
  const variants = buildCountryMatchVariants(recommendationCountry, labelBySlug)
  return variants.some((v) => countryLabelsMatch(v, eventCountryLabel))
}

async function mergeCountryLabelBySlug(
  countryLabelsFromProducts?: Record<string, string>,
): Promise<Record<string, string>> {
  const merged: Record<string, string> = { ...(countryLabelsFromProducts ?? {}) }
  const rows = await prisma.country.findMany({
    select: { countryKey: true, koreanLabel: true },
  })
  for (const row of rows) {
    if (!merged[row.countryKey]) merged[row.countryKey] = row.koreanLabel
  }
  return merged
}

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
  country: string | undefined,
  labelBySlug: Record<string, string>,
): T[] {
  return rows.filter((row) => {
    if (!monthOverlapsEvent(month, row.startMonth, row.endMonth)) return false
    if (!rowMatchesCountry(country, row.countryLabel, labelBySlug)) return false
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
    where: { year, status: 'approved' },
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
  options?: EventLookupOptions,
): Promise<CurationEventDto[]> {
  if (month < 1 || month > 12) return []

  const referenceDate = options?.referenceDate ?? new Date()
  const year = resolveRecommendationEventYear(month, referenceDate)
  const labelBySlug = await mergeCountryLabelBySlug(options?.countryLabels)

  const curationRows = await loadCurationEventsForYear(year)
  const matchedNew = filterByMonthAndCountry(
    curationRows.map((r) => ({ ...r, countryLabel: r.countryCode })),
    month,
    country,
    labelBySlug,
  )

  debugLog('curation-event-repo', 'lookup', {
    month,
    country,
    year,
    curationPool: curationRows.length,
    matchedNew: matchedNew.length,
    variants: country ? buildCountryMatchVariants(country, labelBySlug) : undefined,
  })

  if (matchedNew.length > 0) {
    return matchedNew.map(toDtoFromCurationEvent)
  }

  const legacyRows = await loadLegacyGlobalEventsForYear(year)
  const matchedLegacy = filterByMonthAndCountry(
    legacyRows.map((r) => ({ ...r, countryLabel: r.country })),
    month,
    country,
    labelBySlug,
  )

  debugLog('curation-event-repo', 'legacy fallback', {
    month,
    country,
    legacyPool: legacyRows.length,
    matchedLegacy: matchedLegacy.length,
  })

  return matchedLegacy.map(toDtoFromLegacyEvent)
}

/** trip-recommender 호환 — GlobalEventDescriptor 형태 */
export async function getGlobalEventsForRecommendationMonth(
  month: number,
  country?: string,
  options?: EventLookupOptions,
): Promise<GlobalEventDescriptor[]> {
  const events = await getEventsForRecommendationMonth(month, country, options)
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
  options?: EventLookupOptions,
): Promise<CurationEventDto[]> {
  const { parseMonthsFromMonthRange } = await import('@/lib/bong-marketing/seasonal-event-collector')
  const months = parseMonthsFromMonthRange(monthRange)
  if (!months.length) return []

  const seen = new Set<string>()
  const merged: CurationEventDto[] = []

  for (const month of months) {
    const events = await getEventsForRecommendationMonth(month, country, options)
    for (const event of events) {
      const key = `${event.name}::${event.countryCode}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(event)
    }
  }

  return merged.slice(0, 5)
}
