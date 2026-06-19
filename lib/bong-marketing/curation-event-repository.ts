import { prisma } from '@/lib/prisma'
import { countryLabelsMatch } from '@/lib/bong-marketing/curation-event-gemini-parse'
import { debugLog } from '@/lib/bong-marketing/debug-log'

export type CurationEventSource = 'curation_event'

/** trip-recommender 호환 이벤트 요약 */
export interface GlobalEventDescriptor {
  name: string
  country: string
  city?: string
  description?: string
  appealReason?: string
  source: 'global'
}

/** PR (가)-7-α — 수집·검토 워크플로 */
export type CurationEventStatus = 'draft' | 'approved' | 'rejected'

export interface EventLookupOptions {
  /** trip-recommender Product.country slug → 한글 라벨 */
  countryLabels?: Record<string, string>
  /** PR (가)-6.1 — 추천 카드 도시 (prefer 모드: 전국 + 해당 도시만) */
  city?: string
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

/** 전국·광역 이벤트 city 표기 — 카드 도시 무관 매칭 */
const NATIONWIDE_CITY_LABELS = new Set([
  '전국',
  '전역',
  '전체',
  '국가전체',
  'nationwide',
  'national',
  'countrywide',
])

function normalizeCityToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·・]/g, '')
}

function splitEventCityParts(eventCity: string): string[] {
  return eventCity
    .split(/[,，、/·・]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function cityTokenPairMatch(recommendationCity: string, eventCityPart: string): boolean {
  const rec = normalizeCityToken(recommendationCity)
  const evt = normalizeCityToken(eventCityPart)
  if (!rec || !evt) return false
  if (rec === evt) return true
  return evt.includes(rec) || rec.includes(evt)
}

/** event.city가 전국·광역·비어 있음 → 모든 카드에 매칭 */
export function isNationwideCurationEventCity(city: string | null | undefined): boolean {
  if (city == null || !city.trim()) return true
  return NATIONWIDE_CITY_LABELS.has(normalizeCityToken(city))
}

/**
 * PR (가)-6.1 — 추천 카드 city ↔ CurationEvent.city (prefer 모드, default).
 * REGRESSION-FREEZE[trip-rec-curation-event-city-match]: 전국/null 허용 + 도시 일치/부분일치만 — manifest
 *
 * 우선순위:
 * 1. event.city 전국·전역·null → 매칭
 * 2. 카드·이벤트 도시 정확 일치
 * 3. 부분 일치 (예: '도쿄' ↔ '도쿄, 시부야')
 * 4. 그 외 제외
 */
export function cityLabelsMatch(
  recommendationCity: string | undefined,
  eventCity: string | null | undefined,
): boolean {
  if (isNationwideCurationEventCity(eventCity)) return true
  const rec = recommendationCity?.trim()
  if (!rec) return true

  const evt = eventCity!.trim()
  const parts = splitEventCityParts(evt)
  if (parts.some((part) => cityTokenPairMatch(rec, part))) return true
  return cityTokenPairMatch(rec, evt)
}

function rowMatchesCity(
  recommendationCity: string | undefined,
  eventCity: string | null | undefined,
): boolean {
  return cityLabelsMatch(recommendationCity, eventCity)
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

/** PR (가)-5 — 본체 월별 큐레이션 FK 매핑용 */
export interface ApprovedCurationEventRecord extends CurationEventDto {
  id: string
  monthlyCurationContentId: string | null
}

/** PR (가)-3 dual-read — calendar month vs event span (연말 걸침 포함) */
export function monthOverlapsEvent(month: number, startMonth: number, endMonth: number): boolean {
  if (month < 1 || month > 12) return false
  if (startMonth <= endMonth) return month >= startMonth && month <= endMonth
  return month >= startMonth || month <= endMonth
}

function filterByMonthCountryAndCity<
  T extends { startMonth: number; endMonth: number; countryLabel: string; city: string | null },
>(
  rows: T[],
  month: number,
  country: string | undefined,
  recommendationCity: string | undefined,
  labelBySlug: Record<string, string>,
): T[] {
  return rows.filter((row) => {
    if (!monthOverlapsEvent(month, row.startMonth, row.endMonth)) return false
    if (!rowMatchesCountry(country, row.countryLabel, labelBySlug)) return false
    if (!rowMatchesCity(recommendationCity, row.city)) return false
    return true
  })
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

async function loadCurationEventsForYear(year: number) {
  return prisma.curationEvent.findMany({
    where: { year, status: 'approved' },
    orderBy: [{ startMonth: 'asc' }, { startDay: 'asc' }],
  })
}

function parseMonthKey(monthKey: string): { year: number; month: number } | null {
  const trimmed = monthKey.trim()
  if (!/^\d{4}-\d{2}$/.test(trimmed)) return null
  const [yearStr, monthStr] = trimmed.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  if (!Number.isFinite(year) || month < 1 || month > 12) return null
  return { year, month }
}

/**
 * PR (가)-5 — 본체 generateMonthlyCuration용 approved pool (legacy fallback 없음).
 * monthKey(YYYY-MM) + 선택적 countryCode(한글/slug) 기준.
 */
export async function getApprovedCurationEventsForMonth(
  monthKey: string,
  countryCode?: string,
): Promise<ApprovedCurationEventRecord[]> {
  const parsed = parseMonthKey(monthKey)
  if (!parsed) return []

  const { year, month } = parsed

  try {
    const labelBySlug = await mergeCountryLabelBySlug()
    const rows = await prisma.curationEvent.findMany({
      where: { year, status: 'approved' },
      orderBy: [{ startMonth: 'asc' }, { startDay: 'asc' }],
      select: {
        id: true,
        name: true,
        countryCode: true,
        city: true,
        startMonth: true,
        startDay: true,
        endMonth: true,
        endDay: true,
        type: true,
        description: true,
        appealReason: true,
        monthlyCurationContentId: true,
      },
    })

    const matched = filterByMonthAndCountry(
      rows.map((r) => ({ ...r, countryLabel: r.countryCode })),
      month,
      countryCode,
      labelBySlug,
    )

    debugLog('curation-event-repo', 'monthly-curation pool', {
      monthKey,
      countryCode,
      year,
      month,
      pool: rows.length,
      matched: matched.length,
    })

    return matched.map((row) => ({
      ...toDtoFromCurationEvent(row),
      id: row.id,
      monthlyCurationContentId: row.monthlyCurationContentId,
    }))
  } catch (err) {
    debugLog('curation-event-repo', 'monthly-curation pool error', {
      monthKey,
      countryCode,
      message: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

/** approved CurationEvent pool — month·country 필터 */
export async function getEventsForRecommendationMonth(
  month: number,
  country?: string,
  options?: EventLookupOptions,
): Promise<CurationEventDto[]> {
  if (month < 1 || month > 12) return []

  const referenceDate = options?.referenceDate ?? new Date()
  const year = resolveRecommendationEventYear(month, referenceDate)
  const labelBySlug = await mergeCountryLabelBySlug(options?.countryLabels)
  const recommendationCity = options?.city

  const curationRows = await loadCurationEventsForYear(year)
  const matchedNew = filterByMonthCountryAndCity(
    curationRows.map((r) => ({ ...r, countryLabel: r.countryCode })),
    month,
    country,
    recommendationCity,
    labelBySlug,
  )

  debugLog('curation-event-repo', 'lookup', {
    month,
    country,
    city: recommendationCity,
    year,
    curationPool: curationRows.length,
    matchedNew: matchedNew.length,
    variants: country ? buildCountryMatchVariants(country, labelBySlug) : undefined,
  })

  return matchedNew.map(toDtoFromCurationEvent)
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

/** 월 범위 문자열 — approved CurationEvent pool (월별 merge) */
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
