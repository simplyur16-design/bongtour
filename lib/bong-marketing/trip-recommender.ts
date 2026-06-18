import { prisma } from '@/lib/prisma'
import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import { parseGeminiJsonOutput } from '@/lib/bong-marketing/gemini-json-parse'
import { debugLog } from '@/lib/bong-marketing/debug-log'
import {
  getGlobalEventsForRecommendationMonth,
} from '@/lib/bong-marketing/curation-event-repository'

const TRIP_RECOMMEND_MODEL = (process.env.CARD_NEWS_GEMINI_MODEL || 'gemini-2.5-pro').trim()

/** 카드뉴스·블로그 API 호환용 — 추천 분류 기준은 month */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface TripRecommendationEvent {
  name: string
  type: 'global-festival'
  city?: string
  appealReason?: string
}

export interface TripRecommendationItem {
  /** 추천 대상 월 (1–12) */
  month: number
  /** 표시용 "7월" */
  monthLabel: string
  city: string
  country: string
  urgency: string
  reason: string
  recommendedTripNights: number
  recommendedTripDays: number
  matchingProductIds: string[]
  themes?: string[]
  events?: TripRecommendationEvent[]
  /** @deprecated 카드뉴스·블로그 API 호환 — monthToSeason(month) */
  season?: Season
  /** @deprecated monthLabel 과 동일 — 하위 API 호환 */
  monthRange?: string
}

export interface TripRecommendation {
  generatedAt: string
  /** 롤링 12개월 창 (항상 12) */
  windowMonths: number
  /** UI 섹션 시작 월 (현재 월) */
  startMonth: number
  recommendations: TripRecommendationItem[]
  totalProductsAnalyzed: number
}

export interface ProductSummary {
  id: string
  title: string
  country: string | null
  city: string | null
  continent: string | null
  displayCategory: string | null
  themes: string[]
  tripNights: number | null
  tripDays: number | null
}

const VALID_SEASONS = new Set<Season>(['spring', 'summer', 'autumn', 'winter'])

export function monthLabelFromNumber(month: number): string {
  return `${month}월`
}

/** 현재 월부터 12개월 롤링 순서 (예: 6월 시작 → 6,7,...,12,1,...,5) */
export function rollingMonthsFrom(startMonth: number, count = 12): number[] {
  const start = Math.min(12, Math.max(1, Math.floor(startMonth)))
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    out.push(((start - 1 + i) % 12) + 1)
  }
  return out
}

/** 월 → 계절 (카드뉴스·블로그 레거시 API용, 추천 UI 분류에는 사용 안 함) */
export function monthToSeason(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

export function parseMonthNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.floor(value)
    if (n >= 1 && n <= 12) return n
  }
  if (typeof value === 'string' && value.trim()) {
    const single = value.trim().match(/^(\d{1,2})\s*월$/)
    if (single) {
      const n = parseInt(single[1], 10)
      if (n >= 1 && n <= 12) return n
    }
    const range = value.match(/(\d{1,2})\s*[-~]\s*(\d{1,2})\s*월/)
    if (range) {
      const n = parseInt(range[1], 10)
      if (n >= 1 && n <= 12) return n
    }
    const anyMonth = value.match(/(\d{1,2})\s*월/)
    if (anyMonth) {
      const n = parseInt(anyMonth[1], 10)
      if (n >= 1 && n <= 12) return n
    }
  }
  return null
}

export function extractThemes(themeTagsRaw: string | null, themeLabelsRaw: string | null): string[] {
  const themes: string[] = []
  if (themeTagsRaw?.trim()) {
    const trimmed = themeTagsRaw.trim()
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown
        if (Array.isArray(parsed)) themes.push(...parsed.map(String))
      } catch {
        themes.push(...trimmed.split(',').map((t) => t.trim()).filter(Boolean))
      }
    } else {
      themes.push(...trimmed.split(',').map((t) => t.trim()).filter(Boolean))
    }
  }
  if (themeLabelsRaw?.trim()) {
    themes.push(...themeLabelsRaw.split(',').map((t) => t.trim()).filter(Boolean))
  }
  return [...new Set(themes.filter(Boolean))]
}

export function groupCitiesByCountry(products: ProductSummary[]): Record<string, string[]> {
  const byCountry: Record<string, Set<string>> = {}
  for (const p of products) {
    const country = p.country?.trim() || '기타'
    if (!byCountry[country]) byCountry[country] = new Set()
    if (p.city?.trim()) byCountry[country].add(p.city.trim())
  }
  const result: Record<string, string[]> = {}
  for (const [country, cities] of Object.entries(byCountry)) {
    result[country] = Array.from(cities).sort()
  }
  return result
}

function slugToLabel(slug: string): string {
  return slug
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

async function loadGeoLabels(products: ProductSummary[]): Promise<{
  countries: Record<string, string>
  cities: Record<string, string>
}> {
  const countryKeys = [...new Set(products.map((p) => p.country).filter(Boolean))] as string[]
  const cityKeys = [...new Set(products.map((p) => p.city).filter(Boolean))] as string[]

  const [countryRows, cityRows] = await Promise.all([
    countryKeys.length
      ? prisma.country.findMany({
          where: { countryKey: { in: countryKeys } },
          select: { countryKey: true, koreanLabel: true },
        })
      : Promise.resolve([]),
    cityKeys.length
      ? prisma.city.findMany({
          where: { cityKey: { in: cityKeys } },
          select: { cityKey: true, koreanLabel: true },
        })
      : Promise.resolve([]),
  ])

  const countries: Record<string, string> = {}
  for (const row of countryRows) {
    countries[row.countryKey] = row.koreanLabel
  }
  const cities: Record<string, string> = {}
  for (const row of cityRows) {
    cities[row.cityKey] = row.koreanLabel
  }
  return { countries, cities }
}

function displayCountry(slug: string, labels: Record<string, string>): string {
  return labels[slug] ?? slugToLabel(slug)
}

function displayCity(slug: string, labels: Record<string, string>): string {
  return labels[slug] ?? slugToLabel(slug)
}

async function loadActiveProductsSummary(): Promise<ProductSummary[]> {
  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      autoUnpublishedAt: null,
      OR: [{ city: { not: null } }, { country: { not: null } }],
    },
    select: {
      id: true,
      title: true,
      country: true,
      city: true,
      continent: true,
      displayCategory: true,
      themeTags: true,
      themeLabelsRaw: true,
      tripNights: true,
      tripDays: true,
    },
    take: 500,
  })

  return products.map((p) => ({
    id: p.id,
    title: p.title,
    country: p.country,
    city: p.city,
    continent: p.continent,
    displayCategory: p.displayCategory,
    themes: extractThemes(p.themeTags, p.themeLabelsRaw),
    tripNights: p.tripNights,
    tripDays: p.tripDays,
  }))
}

function buildRecommenderSystemPrompt(): string {
  return `
당신은 봉투어의 월별 해외여행 큐레이터입니다.
봉투어가 운영하는 해외여행 상품 목록을 분석해서,
"한국인이 월별로 가기 좋은 해외 여행지"를 **월(1~12월) 단위**로 추천하세요.

규칙:
- 현재달 + 1개월 이후 미래만 추천 (예: 6월이면 7월~12월 + 내년 1~6월)
- **월별로 그룹화** — 각 대상 월마다 도시 2~5개
- 봄/여름/가을/겨울 4분류 사용 금지 — 반드시 month 숫자(1-12)로 지정
- 각 도시: month (1-12), monthLabel ("7월"), urgency, reason (1-2문장)
- recommendedTripNights(박), recommendedTripDays(일)
- 봉투어 운영 도시·국가만 (입력 목록 안에서만)
- 해당 월의 해외 축제·이벤트 시즌이면 reason에 자연스럽게 언급
- JSON 형식만 반환

응답 형식:
{
  "recommendations": [
    {
      "city": "도시명",
      "country": "국가명",
      "month": 7,
      "monthLabel": "7월",
      "urgency": "단기 출발",
      "reason": "일본 여름 축제 시즌, 한국인 휴가와 맞물림.",
      "themes": ["휴양", "가족"],
      "recommendedTripNights": 4,
      "recommendedTripDays": 5
    }
  ]
}

금지:
- season 필드 사용 금지
- monthRange 범위("3-4월") 금지 — 단일 month만
- 봉투어 미운영 도시 X
- 현재달 이내 X
- 단정형 표현 X
`.trim()
}

function buildRecommenderUserPrompt(
  citiesByCountry: Record<string, string[]>,
  countryLabels: Record<string, string>,
  cityLabels: Record<string, string>,
  currentMonth: number,
  currentYear: number,
): string {
  const cityList = Object.entries(citiesByCountry)
    .map(([countrySlug, cities]) => {
      const country = displayCountry(countrySlug, countryLabels)
      const cityNames = cities.map((c) => displayCity(c, cityLabels)).join(', ')
      return `- ${country}: ${cityNames}`
    })
    .join('\n')

  const monthOrder = rollingMonthsFrom(currentMonth + 1 > 12 ? 1 : currentMonth + 1, 12)
  const monthList = monthOrder.map((m) => `${m}월`).join(', ')

  return `
현재 시점: ${currentYear}년 ${currentMonth}월
추천 대상 월 (각 월별로 도시 추천): ${monthList}

봉투어 운영 도시 (이 목록 안에서만 추천):
${cityList}

각 월마다 한국인에게 가기 좋은 해외 도시를 추천해주세요. 월 단위로만 분류하세요.
`.trim()
}

async function callGeminiTripRecommender(params: {
  systemPrompt: string
  userPrompt: string
}): Promise<{ recommendations?: unknown }> {
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY(또는 GOOGLE_API_KEY) 미설정')
  }

  const modelId = TRIP_RECOMMEND_MODEL || getModelName()
  const maxOutputTokens = 8192
  const timeoutMs = 240_000

  debugLog('trip-recommend', 'gemini call prep', {
    model: modelId,
    systemPromptChars: params.systemPrompt.length,
    userPromptChars: params.userPrompt.length,
  })

  const model = getGenAI().getGenerativeModel({
    model: modelId,
    systemInstruction: params.systemPrompt,
  })

  let lastError = 'unknown'
  let lastRawResponseText = ''

  for (let attempt = 1; attempt <= 2; attempt++) {
    const temperature = attempt === 1 ? 0.7 : 0.6
    try {
      const result = await model.generateContent(
        {
          contents: [{ role: 'user', parts: [{ text: params.userPrompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens,
            ...({ responseMimeType: 'application/json' } as { responseMimeType?: string }),
          },
        },
        geminiTimeoutOpts(timeoutMs),
      )

      lastRawResponseText = result.response.text()
      debugLog('trip-recommend', 'gemini raw (1000):', lastRawResponseText.slice(0, 1000))

      const pj = parseGeminiJsonOutput(lastRawResponseText)
      if (pj.ok) {
        return pj.value as { recommendations?: unknown }
      }

      debugLog('trip-recommend', 'gemini raw (full, json parse fail):', lastRawResponseText)
      lastError = pj.error
      if (attempt === 2) {
        throw new Error(`gemini_parse_failed_after_retry: ${pj.error}`)
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
      if (attempt === 2) {
        throw new Error(`gemini_generate_failed: ${lastError}`)
      }
    }
  }

  throw new Error(`gemini_generate_unreachable: ${lastError}`)
}

export function matchProductIds(
  recommendation: { city: string; country: string },
  products: ProductSummary[],
  cityLabels: Record<string, string>,
  countryLabels: Record<string, string>,
): string[] {
  const cityNeedle = recommendation.city.trim().toLowerCase()
  const countryNeedle = recommendation.country.trim().toLowerCase()

  function fieldMatches(needle: string, slug: string, label: string): boolean {
    if (!needle) return false
    const s = slug.toLowerCase()
    const l = label.toLowerCase()
    if (s && s === needle) return true
    if (l && (l === needle || l.includes(needle) || needle.includes(l))) return true
    return false
  }

  return products
    .filter((p) => {
      const citySlug = p.city ?? ''
      const countrySlug = p.country ?? ''
      const cityLabel = p.city ? (cityLabels[p.city] ?? '') : ''
      const countryLabel = p.country ? (countryLabels[p.country] ?? '') : ''
      const cityMatch = fieldMatches(cityNeedle, citySlug, cityLabel)
      const countryMatch = fieldMatches(countryNeedle, countrySlug, countryLabel)
      return cityMatch || countryMatch
    })
    .slice(0, 10)
    .map((p) => p.id)
}

function parseSeason(value: unknown): Season | null {
  if (typeof value !== 'string') return null
  const s = value.trim().toLowerCase() as Season
  return VALID_SEASONS.has(s) ? s : null
}

function resolveRecommendationMonth(
  raw: Record<string, unknown>,
  currentMonth: number,
): number | null {
  const fromMonth =
    parseMonthNumber(raw.month) ??
    parseMonthNumber(raw.monthLabel) ??
    parseMonthNumber(raw.monthRange)
  if (fromMonth) return fromMonth

  const season = parseSeason(raw.season)
  if (season) {
    const fallback: Record<Season, number> = {
      spring: 4,
      summer: 7,
      autumn: 10,
      winter: 1,
    }
    return fallback[season]
  }

  return null
}

/** 미래 월만 허용 (현재달+1부터 12개월 롤링 창) */
export function isFutureRecommendationMonth(month: number, currentMonth: number): boolean {
  if (month < 1 || month > 12) return false
  const nextMonth = currentMonth >= 12 ? 1 : currentMonth + 1
  return rollingMonthsFrom(nextMonth, 12).includes(month)
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  if (typeof value === 'string' && value.trim()) {
    const n = parseInt(value.trim(), 10)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

export function resolveTripDuration(
  raw: Record<string, unknown>,
  matchingProductIds: string[],
  products: ProductSummary[],
): { nights: number; days: number } {
  const nights = parsePositiveInt(raw.recommendedTripNights)
  const days = parsePositiveInt(raw.recommendedTripDays)
  if (nights && days) return { nights, days }

  const matched = products.filter((p) => matchingProductIds.includes(p.id))
  const withTrip = matched.find((p) => p.tripNights && p.tripDays && p.tripNights > 0 && p.tripDays > 0)
  if (withTrip?.tripNights && withTrip.tripDays) {
    return { nights: withTrip.tripNights, days: withTrip.tripDays }
  }

  return { nights: nights ?? 4, days: days ?? 5 }
}

/**
 * 운영자 [추천 받기] 시 실시간 Gemini 호출. 캐시 없음.
 */
export async function generateTripRecommendations(): Promise<TripRecommendation> {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const products = await loadActiveProductsSummary()
  const citiesByCountry = groupCitiesByCountry(products)
  const { countries: countryLabels, cities: cityLabels } = await loadGeoLabels(products)

  const systemPrompt = buildRecommenderSystemPrompt()
  const userPrompt = buildRecommenderUserPrompt(
    citiesByCountry,
    countryLabels,
    cityLabels,
    currentMonth,
    currentYear,
  )

  const response = await callGeminiTripRecommender({ systemPrompt, userPrompt })

  if (!response.recommendations || !Array.isArray(response.recommendations)) {
    throw new Error('Invalid Gemini response: recommendations array missing')
  }

  let eventLookupFailed = false

  const enriched: TripRecommendationItem[] = []
  for (const raw of response.recommendations) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const month = resolveRecommendationMonth(r, currentMonth)
    if (!month || !isFutureRecommendationMonth(month, currentMonth)) continue

    const city = String(r.city ?? '').trim()
    const country = String(r.country ?? '').trim()
    if (!city || !country) continue

    const matchingProductIds = matchProductIds({ city, country }, products, cityLabels, countryLabels)
    const { nights, days } = resolveTripDuration(r, matchingProductIds, products)
    const monthLabel =
      typeof r.monthLabel === 'string' && r.monthLabel.trim()
        ? r.monthLabel.trim()
        : monthLabelFromNumber(month)

    let events: TripRecommendationEvent[] = []
    try {
      const matched = await getGlobalEventsForRecommendationMonth(month, country, {
        countryLabels,
        referenceDate: now,
      })
      events = matched.map((e) => ({
        name: e.name,
        type: 'global-festival' as const,
        city: e.city,
        appealReason: e.appealReason,
      }))
      if (!events.length) {
        debugLog('trip-recommend', 'event match empty', { month, country, city })
      }
    } catch (e) {
      eventLookupFailed = true
      debugLog('trip-recommend', 'event match failed', e instanceof Error ? e.message : e)
    }

    enriched.push({
      month,
      monthLabel,
      city,
      country,
      urgency: String(r.urgency ?? ''),
      reason: String(r.reason ?? ''),
      recommendedTripNights: nights,
      recommendedTripDays: days,
      themes: Array.isArray(r.themes) ? r.themes.map(String).filter(Boolean) : undefined,
      matchingProductIds,
      events: events.length ? events : undefined,
      season: monthToSeason(month),
      monthRange: monthLabel,
    })
  }

  if (eventLookupFailed) {
    debugLog('trip-recommend', 'some recommendation event lookups failed')
  }

  const startMonth = currentMonth

  return {
    generatedAt: now.toISOString(),
    windowMonths: 12,
    startMonth,
    recommendations: enriched,
    totalProductsAnalyzed: products.length,
  }
}
