import { prisma } from '@/lib/prisma'
import {
  extractFirstBalancedJsonObject,
  parseGeminiJsonOutput,
} from '@/lib/bong-marketing/gemini-json-parse'

const GLOBAL_EVENT_MODEL = (process.env.CARD_NEWS_GEMINI_MODEL || 'gemini-2.5-pro').trim()
/** Gemini 출력 토큰 한계 회피 — 3개국씩 배치 (30개국 ≈ 10배치) */
export const GLOBAL_EVENT_COUNTRY_BATCH_SIZE = 3
const COUNTRY_BATCH_SIZE = GLOBAL_EVENT_COUNTRY_BATCH_SIZE
/** Gemini 2.5 Pro 출력 한도 내 — 대량 이벤트 JSON용 */
const GLOBAL_EVENT_MAX_OUTPUT_TOKENS = 16_384
/** 국가당 이벤트 상한 (프롬프트·파싱 안정성) */
const MAX_EVENTS_PER_COUNTRY = 8
/** Gemini 토큰·품질 한계 — 상품 수 기준 상위 N개국만 수집 */
const MAX_COUNTRIES_FOR_COLLECTION = 30

export interface CollectedEvent {
  name: string
  country: string
  city?: string
  startMonth: number
  startDay?: number
  endMonth: number
  endDay?: number
  type: 'festival' | 'holiday' | 'season' | 'sale' | 'special'
  description?: string
  appealReason?: string
}

export interface GlobalEventCollectError {
  stage: 'gemini_api' | 'json_parse' | 'db_upsert' | 'no_countries' | 'empty_response'
  message: string
  country?: string
}

export interface GlobalEventCollectResult {
  countries: string[]
  collected: number
  saved: number
  skippedDuplicates: number
  /** @deprecated errors 배열 길이 사용 */
  errors: number
  errorDetails: GlobalEventCollectError[]
  rawResponseSamples?: string[]
  batchesRun: number
}

const VALID_TYPES = new Set<CollectedEvent['type']>([
  'festival',
  'holiday',
  'season',
  'sale',
  'special',
])

function slugToKoreanFallback(slug: string): string {
  return slug
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function isBrowseCountrySlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value.trim())
}

function hasHangul(value: string): boolean {
  return /[가-힣]/.test(value)
}

export function parseGlobalEventsResponse(response: unknown): CollectedEvent[] {
  if (!response || typeof response !== 'object') return []
  const events = (response as { events?: unknown }).events
  if (!Array.isArray(events)) return []

  const parsed: CollectedEvent[] = []
  for (const raw of events) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    const country = typeof row.country === 'string' ? row.country.trim() : ''
    const startMonth = typeof row.startMonth === 'number' ? row.startMonth : NaN
    const endMonth = typeof row.endMonth === 'number' ? row.endMonth : NaN
    if (!name || !country || !Number.isFinite(startMonth) || !Number.isFinite(endMonth)) continue

    const typeRaw = typeof row.type === 'string' ? row.type.trim() : 'special'
    const type = VALID_TYPES.has(typeRaw as CollectedEvent['type'])
      ? (typeRaw as CollectedEvent['type'])
      : 'special'

    parsed.push({
      name,
      country,
      city: typeof row.city === 'string' ? row.city.trim() : undefined,
      startMonth: Math.min(12, Math.max(1, startMonth)),
      endMonth: Math.min(12, Math.max(1, endMonth)),
      startDay: typeof row.startDay === 'number' ? row.startDay : undefined,
      endDay: typeof row.endDay === 'number' ? row.endDay : undefined,
      type,
      description: typeof row.description === 'string' ? row.description.trim() : undefined,
      appealReason: typeof row.appealReason === 'string' ? row.appealReason.trim() : undefined,
    })
  }

  const seen = new Set<string>()
  return parsed.filter((e) => {
    const key = `${e.name}::${e.country}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Gemini 응답이 토큰 한계로 잘렸을 때 events 배열 안의 **완전한 객체**만 추출.
 * 0개보다 일부라도 저장하기 위한 salvage 경로.
 */
export function salvageEventsFromTruncatedJson(rawText: string): CollectedEvent[] {
  const pj = parseGeminiJsonOutput(rawText)
  if (pj.ok) return parseGlobalEventsResponse(pj.value)

  const eventsKey = rawText.match(/"events"\s*:\s*\[/)
  if (!eventsKey || eventsKey.index === undefined) return []

  let cursor = rawText.indexOf('[', eventsKey.index) + 1
  const objects: Record<string, unknown>[] = []

  while (cursor < rawText.length) {
    while (cursor < rawText.length && /[\s,]/.test(rawText[cursor])) cursor++
    if (cursor >= rawText.length || rawText[cursor] === ']') break
    if (rawText[cursor] !== '{') break

    const balanced = extractFirstBalancedJsonObject(rawText.slice(cursor))
    if (!balanced) break

    try {
      const obj = JSON.parse(balanced) as Record<string, unknown>
      if (obj && typeof obj === 'object') objects.push(obj)
    } catch {
      break
    }
    cursor += balanced.length
  }

  return parseGlobalEventsResponse({ events: objects })
}

export function parseGlobalEventsFromGeminiRaw(rawText: string): {
  events: CollectedEvent[]
  partial: boolean
  parseError?: string
} {
  const salvaged = salvageEventsFromTruncatedJson(rawText)
  if (salvaged.length) {
    const pj = parseGeminiJsonOutput(rawText)
    return {
      events: salvaged,
      partial: !pj.ok,
      parseError: pj.ok ? undefined : pj.error,
    }
  }

  const pj = parseGeminiJsonOutput(rawText)
  if (pj.ok) {
    return { events: parseGlobalEventsResponse(pj.value), partial: false }
  }

  return { events: [], partial: false, parseError: pj.error }
}

/**
 * 봉투어 Product에 등록된 국가 라벨 전체 (정렬·상한 없음).
 */
export async function listBongtourProductCountryLabels(): Promise<string[]> {
  const grouped = await prisma.product.groupBy({
    by: ['country'],
    where: {
      registrationStatus: 'registered',
      autoUnpublishedAt: null,
      country: { not: null },
    },
    _count: { _all: true },
    orderBy: { _count: { country: 'desc' } },
  })

  const rawCountries = grouped
    .map((g) => g.country)
    .filter((c): c is string => Boolean(c?.trim()))

  if (!rawCountries.length) return []

  const koreanDirect: string[] = []
  const slugKeys: string[] = []
  for (const value of rawCountries) {
    const v = value.trim()
    if (hasHangul(v)) koreanDirect.push(v)
    else if (isBrowseCountrySlug(v)) slugKeys.push(v)
    else koreanDirect.push(v)
  }

  const mappedFromSlugs: string[] = []
  if (slugKeys.length) {
    const countryRows = await prisma.country.findMany({
      where: { countryKey: { in: slugKeys } },
      select: { countryKey: true, koreanLabel: true },
    })
    const labelByKey = new Map(countryRows.map((r) => [r.countryKey, r.koreanLabel]))
    for (const key of slugKeys) {
      mappedFromSlugs.push(labelByKey.get(key) ?? slugToKoreanFallback(key))
    }
  }

  const merged = [...new Set([...koreanDirect, ...mappedFromSlugs].filter(Boolean))]
  return merged
}

/**
 * 봉투어 Product에 등록된 국가 목록 (한국어 라벨, 가나다순 상위 N).
 * Product.country는 browse 슬러그(japan) 또는 한글(일본) 모두 허용.
 */
export async function getBongtourProductCountries(): Promise<string[]> {
  const merged = await listBongtourProductCountryLabels()
  merged.sort((a, b) => a.localeCompare(b, 'ko'))
  return merged.slice(0, MAX_COUNTRIES_FOR_COLLECTION)
}

/**
 * @deprecated PR (가)-4 — write 경로는 CurationEvent. `refreshCurationEvents` 호환 alias.
 */
export async function refreshGlobalEvents(): Promise<GlobalEventCollectResult> {
  const { refreshCurationEvents } = await import('@/lib/bong-marketing/curation-event-collector')
  return refreshCurationEvents()
}

function monthOverlapsEvent(month: number, startMonth: number, endMonth: number): boolean {
  if (startMonth <= endMonth) return month >= startMonth && month <= endMonth
  return month >= startMonth || month <= endMonth
}

function normalizeCountryLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

/** 추천 카드 국가명과 이벤트 country 느슨 매칭 */
export function countryLabelsMatch(recommendationCountry: string, eventCountry: string): boolean {
  const a = normalizeCountryLabel(recommendationCountry)
  const b = normalizeCountryLabel(eventCountry)
  if (!a || !b) return false
  if (a === b) return true
  return a.includes(b) || b.includes(a)
}

/** 특정 월의 글로벌 이벤트 조회 */
export async function getEventsForMonth(month: number, country?: string) {
  const year = new Date().getFullYear()

  const rows = await prisma.bongGlobalEvent.findMany({
    where: { year },
    orderBy: [{ startMonth: 'asc' }, { startDay: 'asc' }],
  })

  return rows.filter((e) => {
    if (!monthOverlapsEvent(month, e.startMonth, e.endMonth)) return false
    if (country && !countryLabelsMatch(country, e.country)) return false
    return true
  })
}

export interface GlobalEventDescriptor {
  name: string
  country: string
  city?: string
  description?: string
  appealReason?: string
  source: 'global'
}

export async function getGlobalEventsForRecommendationMonth(
  month: number,
  country?: string,
): Promise<GlobalEventDescriptor[]> {
  if (month < 1 || month > 12) return []
  const events = await getEventsForMonth(month, country)
  return events.map((e) => ({
    name: e.name,
    country: e.country,
    city: e.city ?? undefined,
    description: e.description ?? undefined,
    appealReason: e.appealReason ?? undefined,
    source: 'global' as const,
  }))
}

/** 추천 카드용 — 글로벌 DB 이벤트만 (한국 시즌 제외) */
export async function getGlobalEventsForRecommendationMonthRange(
  monthRange: string,
  country?: string,
): Promise<GlobalEventDescriptor[]> {
  const { parseMonthsFromMonthRange } = await import('@/lib/bong-marketing/seasonal-event-collector')
  const months = parseMonthsFromMonthRange(monthRange)
  if (!months.length) return []

  const seen = new Set<string>()
  const merged: GlobalEventDescriptor[] = []

  for (const month of months) {
    const events = await getEventsForMonth(month, country)
    for (const event of events) {
      const key = `${event.name}::${event.country}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push({
        name: event.name,
        country: event.country,
        city: event.city ?? undefined,
        description: event.description ?? undefined,
        appealReason: event.appealReason ?? undefined,
        source: 'global',
      })
    }
  }

  return merged.slice(0, 5)
}
