import { prisma } from '@/lib/prisma'
import { generateGeminiJsonResponse } from '@/lib/bong-marketing/gemini-generate'
import { debugLog, debugError } from '@/lib/bong-marketing/debug-log'

const GLOBAL_EVENT_MODEL = (process.env.CARD_NEWS_GEMINI_MODEL || 'gemini-2.5-pro').trim()

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

export interface GlobalEventCollectResult {
  countries: string[]
  collected: number
  saved: number
  skippedDuplicates: number
  errors: number
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
 * Product.country = browse 국가 슬러그 → Country.koreanLabel 매핑.
 */
export async function getBongtourProductCountries(): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      autoUnpublishedAt: null,
      country: { not: null },
    },
    select: { country: true },
    distinct: ['country'],
  })

  const countryKeys = products
    .map((p) => p.country)
    .filter((c): c is string => Boolean(c?.trim()))

  if (!countryKeys.length) return []

  const countryRows = await prisma.country.findMany({
    where: { countryKey: { in: countryKeys } },
    select: { countryKey: true, koreanLabel: true },
  })

  const labelByKey = new Map(countryRows.map((r) => [r.countryKey, r.koreanLabel]))
  const labels = countryKeys.map((key) => labelByKey.get(key) ?? slugToKoreanFallback(key))

  return [...new Set(labels.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))
}

async function collectEventsForCountries(countries: string[], year: number): Promise<CollectedEvent[]> {
  const countryList = countries.join(', ')

  const systemPrompt = `당신은 한국인 대상 해외여행 큐레이션 전문가입니다.

다음 국가들의 ${year}년 향후 3-12개월 내 열리는 이벤트·축제를 수집하세요:
${countryList}

규칙:
- 한국인 여행객에게 어필할 수 있는 이벤트만 (한국에서 인기 있거나 SNS에서 핫한 것)
- 매년 정기 이벤트 또는 ${year}년 특정 이벤트
- country 필드는 위 국가 목록의 한국어 국가명과 정확히 일치
- type: "festival" (축제) | "holiday" (공휴일) | "season" (계절 행사) | "sale" (세일 시즌) | "special" (기타 특별)
- 각 국가별 최소 3개 이상 수집
- 전체 최소 30개 이상 수집

응답은 반드시 다음 JSON 형식만 (다른 텍스트 X):
{
  "events": [
    {
      "name": "후지 록 페스티벌",
      "country": "일본",
      "city": "니이가타",
      "startMonth": 7,
      "startDay": 25,
      "endMonth": 7,
      "endDay": 27,
      "type": "festival",
      "description": "일본 최대 록 페스티벌",
      "appealReason": "한국 음악 팬에게 인기, 여름 휴가 시즌과 맞물림"
    }
  ]
}`.trim()

  const response = await generateGeminiJsonResponse<{ events?: unknown }>({
    model: GLOBAL_EVENT_MODEL,
    systemPrompt,
    userPrompt: `${year}년 이벤트 30개 이상 JSON 형식으로 응답.`,
    temperature: 0.3,
    maxOutputTokens: 8192,
    timeoutMs: 240_000,
  })

  return parseGlobalEventsResponse(response)
}

/** 메인 함수: 봉투어 Product 국가 → Gemini → BongGlobalEvent 저장. */
export async function refreshGlobalEvents(): Promise<GlobalEventCollectResult> {
  const year = new Date().getFullYear()
  const result: GlobalEventCollectResult = {
    countries: [],
    collected: 0,
    saved: 0,
    skippedDuplicates: 0,
    errors: 0,
  }

  const countries = await getBongtourProductCountries()
  result.countries = countries

  if (!countries.length) {
    debugLog('global-event', '봉투어 Product 국가 없음')
    return result
  }

  debugLog('global-event', `${countries.length}개 국가에서 이벤트 수집 시작: ${countries.join(', ')}`)

  let events: CollectedEvent[] = []
  try {
    events = await collectEventsForCountries(countries, year)
  } catch (err) {
    debugError('global-event', 'Gemini 수집 실패:', err)
    result.errors++
    return result
  }

  result.collected = events.length

  if (!events.length) {
    debugError('global-event', 'Gemini가 이벤트 0개 반환')
    result.errors++
    return result
  }

  for (const event of events) {
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
      debugError('global-event', `이벤트 저장 실패 (${event.name}):`, err)
      result.errors++
    }
  }

  debugLog('global-event', '완료:', result)
  return result
}

function monthOverlapsEvent(month: number, startMonth: number, endMonth: number): boolean {
  if (startMonth <= endMonth) return month >= startMonth && month <= endMonth
  return month >= startMonth || month <= endMonth
}

/** 특정 월의 글로벌 이벤트 조회 (trip-recommender에서 사용). */
export async function getEventsForMonth(month: number, country?: string) {
  const year = new Date().getFullYear()

  const rows = await prisma.bongGlobalEvent.findMany({
    where: {
      year,
      ...(country ? { country } : {}),
    },
    orderBy: [{ startMonth: 'asc' }, { startDay: 'asc' }],
  })

  return rows.filter((e) => monthOverlapsEvent(month, e.startMonth, e.endMonth))
}
