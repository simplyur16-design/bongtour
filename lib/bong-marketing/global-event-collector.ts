import { prisma } from '@/lib/prisma'
import { generateGeminiJsonResponse } from '@/lib/bong-marketing/gemini-generate'
import { debugLog, debugError } from '@/lib/bong-marketing/debug-log'

const GLOBAL_EVENT_MODEL = (process.env.CARD_NEWS_GEMINI_MODEL || 'gemini-2.5-pro').trim()
const COUNTRY_BATCH_SIZE = 5
/** Gemini 토큰·품질 한계 — 상품 수 기준 상위 N개국만 수집 (배치는 5개국씩) */
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
 * 봉투어 Product에 등록된 국가 목록 (한국어 라벨).
 * Product.country는 browse 슬러그(japan) 또는 한글(일본) 모두 허용.
 */
export async function getBongtourProductCountries(): Promise<string[]> {
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
  merged.sort((a, b) => a.localeCompare(b, 'ko'))
  return merged.slice(0, MAX_COUNTRIES_FOR_COLLECTION)
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function collectEventsForCountryBatch(
  countries: string[],
  year: number,
): Promise<{ events: CollectedEvent[]; rawPreview: string }> {
  const countryList = countries.join(', ')

  const systemPrompt = `당신은 한국인 대상 해외여행 큐레이션 전문가입니다.

다음 국가들의 ${year}년 향후 3-12개월 내 열리는 **해외** 이벤트·축제만 수집하세요:
${countryList}

규칙:
- 한국인 여행객에게 어필할 수 있는 해외 이벤트만
- 한국 국내 축제·지역 행사는 절대 포함하지 마세요
- country 필드는 위 국가 목록의 한국어 국가명과 정확히 일치
- type: "festival" | "holiday" | "season" | "sale" | "special"
- **각 국가별 최소 2개** 이벤트

응답은 반드시 JSON만:
{
  "events": [
    {
      "name": "다낭 국제 불꽃축제",
      "country": "베트남",
      "city": "다낭",
      "startMonth": 6,
      "endMonth": 7,
      "type": "festival",
      "description": "해안 불꽃쇼",
      "appealReason": "여름 휴가 시즌 인기"
    }
  ]
}`.trim()

  const response = await generateGeminiJsonResponse<{ events?: unknown }>({
    model: GLOBAL_EVENT_MODEL,
    systemPrompt,
    userPrompt: `${year}년 ${countryList} 해외 이벤트 JSON (국가당 2개 이상).`,
    temperature: 0.3,
    maxOutputTokens: 4096,
    timeoutMs: 120_000,
  })

  const rawPreview = JSON.stringify(response).slice(0, 500)
  const events = parseGlobalEventsResponse(response)
  return { events, rawPreview }
}

/** 메인 함수: 봉투어 Product 국가 → Gemini(배치) → BongGlobalEvent 저장. */
export async function refreshGlobalEvents(): Promise<GlobalEventCollectResult> {
  const year = new Date().getFullYear()
  const result: GlobalEventCollectResult = {
    countries: [],
    collected: 0,
    saved: 0,
    skippedDuplicates: 0,
    errors: 0,
    errorDetails: [],
    rawResponseSamples: [],
    batchesRun: 0,
  }

  const countries = await getBongtourProductCountries()
  result.countries = countries

  if (!countries.length) {
    result.errorDetails.push({
      stage: 'no_countries',
      message: '등록 상품에서 국가를 찾지 못했습니다.',
    })
    result.errors = result.errorDetails.length
    debugLog('global-event', '봉투어 Product 국가 없음')
    return result
  }

  debugLog(
    'global-event',
    `${countries.length}개 국가, ${chunkArray(countries, COUNTRY_BATCH_SIZE).length}배치 수집 시작`,
  )

  const allEvents: CollectedEvent[] = []
  const batches = chunkArray(countries, COUNTRY_BATCH_SIZE)

  for (const batch of batches) {
    result.batchesRun++
    const batchLabel = batch.join(', ')
    try {
      const { events, rawPreview } = await collectEventsForCountryBatch(batch, year)
      if (result.rawResponseSamples && result.rawResponseSamples.length < 3) {
        result.rawResponseSamples.push(`[${batchLabel}] ${rawPreview}`)
      }

      if (!events.length) {
        result.errorDetails.push({
          stage: 'json_parse',
          message: 'Gemini 응답에서 유효한 이벤트 0개 (파싱 결과 빈 배열)',
          country: batchLabel,
        })
        debugError('global-event', `배치 파싱 0건: ${batchLabel}`, rawPreview)
        continue
      }

      allEvents.push(...events)
      debugLog('global-event', `배치 수집 ${events.length}건: ${batchLabel}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.errorDetails.push({
        stage: 'gemini_api',
        message,
        country: batchLabel,
      })
      debugError('global-event', `배치 Gemini 실패 (${batchLabel}):`, err)
    }
  }

  result.collected = allEvents.length

  if (!allEvents.length) {
    if (!result.errorDetails.some((e) => e.stage === 'empty_response')) {
      result.errorDetails.push({
        stage: 'empty_response',
        message:
          '전체 배치에서 이벤트 0개 — Gemini API 실패·JSON 파싱 실패·응답 토큰 초과 가능성. errorDetails 참고.',
      })
    }
    result.errors = result.errorDetails.length
    return result
  }

  for (const event of allEvents) {
    try {
      const existing = await prisma.bongGlobalEvent.findFirst({
        where: { name: event.name, country: event.country, year },
      })

      if (existing) {
        await prisma.bongGlobalEvent.update({
          where: { id: existing.id },
          data: {
            city: event.city ?? null,
            startMonth: event.startMonth,
            startDay: event.startDay ?? null,
            endMonth: event.endMonth,
            endDay: event.endDay ?? null,
            type: event.type,
            description: event.description ?? null,
            appealReason: event.appealReason ?? null,
            collectedAt: new Date(),
          },
        })
        result.skippedDuplicates++
      } else {
        await prisma.bongGlobalEvent.create({
          data: {
            name: event.name,
            country: event.country,
            city: event.city ?? null,
            startMonth: event.startMonth,
            startDay: event.startDay ?? null,
            endMonth: event.endMonth,
            endDay: event.endDay ?? null,
            type: event.type,
            description: event.description ?? null,
            appealReason: event.appealReason ?? null,
            year,
          },
        })
        result.saved++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.errorDetails.push({
        stage: 'db_upsert',
        message: `${event.name}: ${message}`,
        country: event.country,
      })
      debugError('global-event', `이벤트 저장 실패 (${event.name}):`, err)
    }
  }

  result.errors = result.errorDetails.length
  debugLog('global-event', '완료:', result)
  return result
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
