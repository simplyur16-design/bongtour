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

const EVENT_SEARCH_KEYWORDS = [
  '여름 휴가 성수기',
  '겨울 휴가 시즌',
  '가족여행 시즌',
  '여름방학 기간',
  '겨울방학 기간',
  '황금연휴',
  '추석 연휴 여행',
  '설날 연휴 여행',
  '봄 단풍 시즌',
]

const VALID_TYPES = new Set<SeasonalEvent['type']>([
  'season',
  'vacation',
  'school',
  'holiday',
  'special',
])

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
      : 'special'
    parsed.push({
      name,
      startMonth: Math.min(12, Math.max(1, startMonth)),
      endMonth: Math.min(12, Math.max(1, endMonth)),
      startDay: typeof row.startDay === 'number' ? row.startDay : undefined,
      endDay: typeof row.endDay === 'number' ? row.endDay : undefined,
      type,
      description: typeof row.description === 'string' ? row.description.trim() : undefined,
    })
  }

  const seen = new Set<string>()
  return parsed.filter((e) => {
    if (seen.has(e.name)) return false
    seen.add(e.name)
    return true
  }).slice(0, 15)
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
한국 여행 시즌·이벤트 정보를 블로그 글에서 추출해주세요.

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
      "description": "한국 직장인 여름 휴가 절정기"
    }
  ]
}

규칙:
- 한국 사람들의 여행 시즌·이벤트만 추출
- 봄/여름/가을/겨울 시즌은 type="season"
- 휴가는 "vacation", 방학은 "school", 명절·연휴는 "holiday", 특별 이벤트는 "special"
- 날짜 모호하면 startDay/endDay 생략 (월만 사용)
- 중복 제거
- 최대 15개
`.trim()

  const userPrompt = `${year}년 한국 여행 시즌·이벤트 정보가 담긴 블로그 글 모음입니다. 시즌·이벤트를 추출해주세요.\n\n${allBlogTexts.slice(0, 50).join('\n---\n')}`

  const response = await generateGeminiJsonResponse({
    model: EVENT_MODEL,
    systemPrompt,
    userPrompt,
    maxOutputTokens: 4096,
  })

  return parseSeasonalEventsResponse(response)
}
