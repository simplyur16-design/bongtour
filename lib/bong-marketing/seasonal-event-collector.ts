import { generateGeminiJsonResponse } from '@/lib/bong-marketing/gemini-generate'
import { debugLog } from '@/lib/bong-marketing/debug-log'
import { searchNaverBlog } from '@/lib/bong-marketing/naver-search-client'

const EVENT_MODEL = (process.env.CARD_NEWS_GEMINI_MODEL || 'gemini-2.5-pro').trim()

export interface SeasonalEvent {
  name: string
  startMonth: number
  startDay?: number
  endMonth: number
  endDay?: number
  type: 'season' | 'vacation' | 'school' | 'holiday' | 'special'
  description?: string
}

export interface EventDescriptor {
  name: string
  country?: string
  city?: string
  description?: string
  appealReason?: string
  source: 'korean' | 'global'
}

const EVENT_SEARCH_KEYWORDS = [
  '여름 휴가 성수기 해외여행',
  '겨울 휴가 시즌 해외여행',
  '가족여행 성수기 해외',
  '여름방학 해외여행',
  '겨울방학 해외여행',
  '황금연휴 해외여행',
  '추석 연휴 해외여행',
  '설날 연휴 해외여행',
  '봄 해외여행 시즌',
  '가을 해외여행 시즌',
]

/** 출국 타이밍 분석용 — 추천 카드 태그에는 사용하지 않음 */
const ALLOWED_KOREAN_OUTBOUND_TYPES = new Set<SeasonalEvent['type']>([
  'season',
  'vacation',
  'school',
  'holiday',
])

/** 한국 국내 지역 축제·행사 (봉투어 마케팅 무관) */
const KOREAN_DOMESTIC_FESTIVAL_PATTERN =
  /축제|문화제|페스티벌|군항제|딸기|벚꽃|맥주|해변|지역|한옥|온천|마을|농촌|체험|박람회|카니발|퍼레이드|불꽃(?!축제)|유람|캠핑대회/i

const VALID_TYPES = ALLOWED_KOREAN_OUTBOUND_TYPES

export function isKoreanDomesticFestivalName(name: string): boolean {
  const n = name.trim()
  if (!n) return false
  return KOREAN_DOMESTIC_FESTIVAL_PATTERN.test(n)
}

/** 출국 타이밍 분석용 한국 시즌만 허용 (국내 축제 제외) */
export function isAllowedKoreanOutboundSeasonEvent(event: SeasonalEvent): boolean {
  if (!ALLOWED_KOREAN_OUTBOUND_TYPES.has(event.type)) return false
  if (isKoreanDomesticFestivalName(event.name)) return false
  return true
}

export function parseSeasonalEventsResponse(response: unknown): SeasonalEvent[] {
  if (!response || typeof response !== 'object') return []
  const events = (response as { events?: unknown }).events
  if (!Array.isArray(events)) return []

  const parsed: SeasonalEvent[] = []
  for (const raw of events) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    const startMonth = typeof row.startMonth === 'number' ? row.startMonth : NaN
    const endMonth = typeof row.endMonth === 'number' ? row.endMonth : NaN
    if (!name || !Number.isFinite(startMonth) || !Number.isFinite(endMonth)) continue
    const typeRaw = typeof row.type === 'string' ? row.type.trim() : 'special'
    const type = VALID_TYPES.has(typeRaw as SeasonalEvent['type'])
      ? (typeRaw as SeasonalEvent['type'])
      : ('special' as SeasonalEvent['type'])
    const candidate: SeasonalEvent = {
      name,
      startMonth: Math.min(12, Math.max(1, startMonth)),
      endMonth: Math.min(12, Math.max(1, endMonth)),
      startDay: typeof row.startDay === 'number' ? row.startDay : undefined,
      endDay: typeof row.endDay === 'number' ? row.endDay : undefined,
      type,
      description: typeof row.description === 'string' ? row.description.trim() : undefined,
    }
    if (!isAllowedKoreanOutboundSeasonEvent(candidate)) continue
    parsed.push(candidate)
  }

  const seen = new Set<string>()
  return parsed.filter((e) => {
    if (seen.has(e.name)) return false
    seen.add(e.name)
    return true
  }).slice(0, 12)
}

/** monthRange 문자열에서 월 숫자 추출 (예: "7월", "10-11월", "7월~8월") */
export function parseMonthsFromMonthRange(monthRange: string): number[] {
  const months = new Set<number>()

  for (const m of monthRange.matchAll(/(\d{1,2})\s*[-~]\s*(\d{1,2})\s*월/g)) {
    const start = parseInt(m[1], 10)
    const end = parseInt(m[2], 10)
    if (start >= 1 && start <= 12 && end >= 1 && end <= 12) {
      if (start <= end) {
        for (let i = start; i <= end; i++) months.add(i)
      } else {
        for (let i = start; i <= 12; i++) months.add(i)
        for (let i = 1; i <= end; i++) months.add(i)
      }
    }
  }

  for (const m of monthRange.matchAll(/(\d{1,2})\s*월/g)) {
    const n = parseInt(m[1], 10)
    if (n >= 1 && n <= 12) months.add(n)
  }

  return [...months].sort((a, b) => a - b)
}

export function matchEventsForMonthRange(monthRange: string, events: SeasonalEvent[]): string[] {
  const months = parseMonthsFromMonthRange(monthRange)
  if (!months.length || !events.length) return []

  return events
    .filter((event) => {
      const start = event.startMonth
      const end = event.endMonth
      return months.some((m) => {
        if (start <= end) return m >= start && m <= end
        return m >= start || m <= end
      })
    })
    .map((e) => e.name)
    .slice(0, 5)
}

function monthOverlapsEvent(month: number, startMonth: number, endMonth: number): boolean {
  if (startMonth <= endMonth) return month >= startMonth && month <= endMonth
  return month >= startMonth || month <= endMonth
}

async function getKoreanOutboundSeasonEventsForMonth(month: number): Promise<EventDescriptor[]> {
  const events = await getSeasonalEventsCached()
  return events
    .filter(
      (event) =>
        isAllowedKoreanOutboundSeasonEvent(event) &&
        monthOverlapsEvent(month, event.startMonth, event.endMonth),
    )
    .map((e) => ({
      name: e.name,
      description: e.description,
      source: 'korean' as const,
    }))
}

/**
 * @deprecated 추천 카드 태그용 — `getGlobalEventsForRecommendationMonthRange` 사용.
 * 한국 출국 시즌 + 글로벌 통합 (내부 분석용).
 */
export async function getMonthlyEventsForRecommendation(
  month: number,
  country?: string,
): Promise<EventDescriptor[]> {
  const { getEventsForRecommendationMonth } = await import(
    '@/lib/bong-marketing/curation-event-repository'
  )
  const koreanEvents = await getKoreanOutboundSeasonEventsForMonth(month)
  const globalEvents = await getEventsForRecommendationMonth(month, country)

  return [
    ...koreanEvents,
    ...globalEvents.map((e) => ({
      name: e.name,
      country: e.countryCode,
      city: e.city ?? undefined,
      description: e.description ?? undefined,
      appealReason: e.appealReason ?? undefined,
      source: 'global' as const,
    })),
  ]
}

/** @deprecated 추천 카드 — curation-event-repository 의 getEventsForRecommendationMonthRange 사용 */
export async function getEventsForRecommendationMonthRange(
  monthRange: string,
  country?: string,
): Promise<EventDescriptor[]> {
  const months = parseMonthsFromMonthRange(monthRange)
  if (!months.length) return []

  const seen = new Set<string>()
  const merged: EventDescriptor[] = []

  for (const month of months) {
    const events = await getMonthlyEventsForRecommendation(month, country)
    for (const event of events) {
      const key = `${event.source}:${event.name}:${event.country ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(event)
    }
  }

  return merged.slice(0, 5)
}

let cachedEvents: { year: number; data: SeasonalEvent[]; fetchedAt: number } | null = null
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function invalidateSeasonalEventsCache(): void {
  cachedEvents = null
}

export async function getSeasonalEventsCached(): Promise<SeasonalEvent[]> {
  const now = Date.now()
  const year = new Date().getFullYear()
  if (cachedEvents && cachedEvents.year === year && now - cachedEvents.fetchedAt < CACHE_TTL_MS) {
    return cachedEvents.data
  }
  const events = await collectSeasonalEvents(year)
  cachedEvents = { year, data: events, fetchedAt: now }
  return events
}

export async function collectSeasonalEvents(year: number = new Date().getFullYear()): Promise<SeasonalEvent[]> {
  const allBlogTexts: string[] = []

  for (const keyword of EVENT_SEARCH_KEYWORDS) {
    const result = await searchNaverBlog({
      query: `${year} ${keyword}`,
      display: 10,
      sort: 'sim',
    })
    for (const item of result.items) {
      allBlogTexts.push(`${item.title}\n${item.description}`)
    }
  }

  debugLog('seasonal-event', `collected blog snippets: ${allBlogTexts.length}`)

  const systemPrompt = `
한국인 **해외여행 출국 타이밍** 시즌 정보만 블로그 글에서 추출해주세요.

응답 형식 (JSON):
{
  "events": [
    {
      "name": "여름 휴가 성수기",
      "startMonth": 7,
      "startDay": 25,
      "endMonth": 8,
      "endDay": 15,
      "type": "vacation",
      "description": "한국 직장인 여름 휴가 절정기 — 해외여행 수요 피크"
    }
  ]
}

규칙:
- **한국인이 해외로 나가기 좋은 시기**만 (봄/여름/가을/겨울 시즌, 연휴, 방학, 휴가 성수기)
- type: "season" | "vacation" | "school" | "holiday" 만 사용
- **한국 국내 축제·지역 행사 절대 금지** (논산 딸기축제, 진해 군항제, 지역 벚꽃축제, 맥주축제 등)
- "special" 타입 사용 금지
- 날짜 모호하면 startDay/endDay 생략 (월만 사용)
- 중복 제거
- 최대 12개
`.trim()

  const userPrompt = `${year}년 한국인 해외여행 출국 시즌·연휴·방학 정보만 추출하세요. 국내 축제는 제외.\n\n${allBlogTexts.slice(0, 50).join('\n---\n')}`

  const response = await generateGeminiJsonResponse({
    model: EVENT_MODEL,
    systemPrompt,
    userPrompt,
    maxOutputTokens: 4096,
  })

  return parseSeasonalEventsResponse(response)
}
