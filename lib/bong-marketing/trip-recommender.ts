import { prisma } from '@/lib/prisma'
import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import {
  extractFirstBalancedJsonObject,
  parseGeminiJsonOutput,
} from '@/lib/bong-marketing/gemini-json-parse'
import { debugLog, debugError } from '@/lib/bong-marketing/debug-log'
import {
  getGlobalEventsForRecommendationMonth,
} from '@/lib/bong-marketing/curation-event-repository'

const TRIP_RECOMMEND_MODEL = (process.env.CARD_NEWS_GEMINI_MODEL || 'gemini-2.5-pro').trim()
/** 12개월×다수 카드 JSON — 출력 토큰 한계 회피 */
export const TRIP_RECOMMEND_MAX_OUTPUT_TOKENS = 16_384
/** 4개월씩 3배치 (12개월 롤링) */
export const TRIP_RECOMMEND_MONTH_BATCH_SIZE = 4
const MAX_REASON_CHARS = 100
const MAX_CITIES_PER_MONTH = 3

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
  /** 배치·파싱 경고 (부분 salvage 등) */
  errorDetails?: TripRecommendBatchError[]
}

export interface TripRecommendBatchError {
  stage: 'gemini_api' | 'json_parse' | 'json_parse_partial' | 'empty_batch'
  message: string
  months?: string
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/**
 * Gemini 응답이 토큰 한계로 잘렸을 때 recommendations 배열 안 **완전한 객체**만 추출.
 */
export function salvageRecommendationsFromTruncatedJson(rawText: string): unknown[] {
  const pj = parseGeminiJsonOutput(rawText)
  if (pj.ok) {
    const recs = (pj.value as { recommendations?: unknown }).recommendations
    return Array.isArray(recs) ? recs : []
  }

  const recKey = rawText.match(/"recommendations"\s*:\s*\[/)
  if (!recKey || recKey.index === undefined) return []

  let cursor = rawText.indexOf('[', recKey.index) + 1
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

  return objects
}

export function parseTripRecommendationsFromGeminiRaw(rawText: string): {
  recommendations: unknown[]
  partial: boolean
  parseError?: string
} {
  const salvaged = salvageRecommendationsFromTruncatedJson(rawText)
  if (salvaged.length) {
    const pj = parseGeminiJsonOutput(rawText)
    return {
      recommendations: salvaged,
      partial: !pj.ok,
      parseError: pj.ok ? undefined : pj.error,
    }
  }

  const pj = parseGeminiJsonOutput(rawText)
  if (pj.ok) {
    const recs = (pj.value as { recommendations?: unknown }).recommendations
    return {
      recommendations: Array.isArray(recs) ? recs : [],
      partial: false,
    }
  }

  return { recommendations: [], partial: false, parseError: pj.error }
}

function truncateReason(text: string): string {
  const t = text.trim()
  if (t.length <= MAX_REASON_CHARS) return t
  return `${t.slice(0, MAX_REASON_CHARS - 1)}…`
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
- **이번 요청에 지정된 월만** 추천 (다른 월 금지)
- 각 지정 월마다 도시 **2~${MAX_CITIES_PER_MONTH}개** (그 이상 금지)
- 봄/여름/가을/겨울 4분류 사용 금지 — 반드시 month 숫자(1-12)로 지정
- 각 도시: month, monthLabel ("7월"), urgency(10자 이내), reason(**${MAX_REASON_CHARS}자 이내**, 1문장)
- recommendedTripNights(박), recommendedTripDays(일)
- themes는 최대 2개 (짧은 단어)
- 봉투어 운영 도시·국가만 (입력 목록 안에서만)
- country 필드는 입력 목록의 **한국어 국가명**과 일치
- **반드시 유효한 JSON 전체를 출력** — 마지막 객체까지 닫고 \`}\` 완성
- 토큰 한계 임박 시 도시 수를 줄여 **완전한 JSON**으로 마무리
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
      "reason": "일본 여름 축제 시즌.",
      "themes": ["휴양"],
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
- reason ${MAX_REASON_CHARS}자 초과
`.trim()
}

function buildRecommenderUserPrompt(
  citiesByCountry: Record<string, string[]>,
  countryLabels: Record<string, string>,
  cityLabels: Record<string, string>,
  currentMonth: number,
  currentYear: number,
  targetMonths: number[],
): string {
  const cityList = Object.entries(citiesByCountry)
    .map(([countrySlug, cities]) => {
      const country = displayCountry(countrySlug, countryLabels)
      const cityNames = cities.map((c) => displayCity(c, cityLabels)).join(', ')
      return `- ${country}: ${cityNames}`
    })
    .join('\n')

  const monthList = targetMonths.map((m) => `${m}월`).join(', ')

  return `
현재 시점: ${currentYear}년 ${currentMonth}월
**이번 요청 대상 월 (이 월들만 추천, 각 월 2~${MAX_CITIES_PER_MONTH}개 도시):** ${monthList}

봉투어 운영 도시 (이 목록 안에서만 추천):
${cityList}

지정 월마다 한국인에게 가기 좋은 해외 도시를 추천하세요. reason ${MAX_REASON_CHARS}자 이내. 완전한 JSON 필수.
`.trim()
}

async function callGeminiTripRecommender(params: {
  systemPrompt: string
  userPrompt: string
  batchLabel?: string
}): Promise<{ recommendations: unknown[]; partial: boolean; parseError?: string }> {
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY(또는 GOOGLE_API_KEY) 미설정')
  }

  const modelId = TRIP_RECOMMEND_MODEL || getModelName()
  const maxOutputTokens = TRIP_RECOMMEND_MAX_OUTPUT_TOKENS
  const timeoutMs = 240_000

  debugLog('trip-recommend', 'gemini call prep', {
    model: modelId,
    batch: params.batchLabel,
    maxOutputTokens,
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
    const temperature = attempt === 1 ? 0.7 : 0.5
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
      debugLog(
        'trip-recommend',
        `gemini raw${params.batchLabel ? ` [${params.batchLabel}]` : ''} (500):`,
        lastRawResponseText.slice(0, 500),
      )

      const parsed = parseTripRecommendationsFromGeminiRaw(lastRawResponseText)
      if (parsed.recommendations.length) {
        if (parsed.partial) {
          debugLog(
            'trip-recommend',
            `partial salvage ${parsed.recommendations.length} cards${params.batchLabel ? ` (${params.batchLabel})` : ''}`,
            parsed.parseError ?? '',
          )
        }
        return parsed
      }

      if (!parsed.parseError) {
        return { recommendations: [], partial: false }
      }

      debugLog('trip-recommend', 'gemini parse fail:', parsed.parseError)
      lastError = parsed.parseError
      if (attempt === 2) {
        throw new Error(`gemini_parse_failed_after_retry: ${parsed.parseError}`)
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
      if (attempt === 2) {
        if (lastRawResponseText) {
          const salvaged = parseTripRecommendationsFromGeminiRaw(lastRawResponseText)
          if (salvaged.recommendations.length) {
            debugLog(
              'trip-recommend',
              `error-after-retry salvage ${salvaged.recommendations.length}${params.batchLabel ? ` (${params.batchLabel})` : ''}`,
            )
            return salvaged
          }
        }
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
 * 12개월 → 4개월×3배치, 부분 JSON salvage 지원.
 */
export async function generateTripRecommendations(): Promise<TripRecommendation> {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const products = await loadActiveProductsSummary()
  const citiesByCountry = groupCitiesByCountry(products)
  const { countries: countryLabels, cities: cityLabels } = await loadGeoLabels(products)

  const systemPrompt = buildRecommenderSystemPrompt()
  const targetMonths = rollingMonthsFrom(currentMonth + 1 > 12 ? 1 : currentMonth + 1, 12)
  const monthBatches = chunkArray(targetMonths, TRIP_RECOMMEND_MONTH_BATCH_SIZE)
  const errorDetails: TripRecommendBatchError[] = []
  const allRawRecommendations: unknown[] = []

  debugLog(
    'trip-recommend',
    `${targetMonths.length}개월, ${monthBatches.length}배치 수집 시작`,
    targetMonths,
  )

  for (const monthBatch of monthBatches) {
    const batchLabel = monthBatch.map((m) => `${m}월`).join(', ')
    const userPrompt = buildRecommenderUserPrompt(
      citiesByCountry,
      countryLabels,
      cityLabels,
      currentMonth,
      currentYear,
      monthBatch,
    )

    try {
      const batchResult = await callGeminiTripRecommender({
        systemPrompt,
        userPrompt,
        batchLabel,
      })

      if (!batchResult.recommendations.length) {
        errorDetails.push({
          stage: 'empty_batch',
          message: 'Gemini 응답에서 유효한 추천 0개',
          months: batchLabel,
        })
        debugError('trip-recommend', `배치 0건: ${batchLabel}`)
        continue
      }

      allRawRecommendations.push(...batchResult.recommendations)

      if (batchResult.partial) {
        errorDetails.push({
          stage: 'json_parse_partial',
          message: batchResult.parseError ?? '토큰 한계로 부분 salvage',
          months: batchLabel,
        })
      }

      debugLog(
        'trip-recommend',
        `배치 ${batchResult.recommendations.length}건${batchResult.partial ? ' (partial)' : ''}: ${batchLabel}`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errorDetails.push({
        stage: 'gemini_api',
        message,
        months: batchLabel,
      })
      debugError('trip-recommend', `배치 Gemini 실패 (${batchLabel}):`, err)
    }
  }

  if (!allRawRecommendations.length) {
    const detail = JSON.stringify({ errorDetails })
    throw new Error(`trip_recommend_empty: ${detail}`)
  }

  let eventLookupFailed = false

  const enriched: TripRecommendationItem[] = []
  const seenCardKeys = new Set<string>()

  for (const raw of allRawRecommendations) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const month = resolveRecommendationMonth(r, currentMonth)
    if (!month || !isFutureRecommendationMonth(month, currentMonth)) continue

    const city = String(r.city ?? '').trim()
    const country = String(r.country ?? '').trim()
    if (!city || !country) continue

    const cardKey = `${month}::${city}::${country}`
    if (seenCardKeys.has(cardKey)) continue
    seenCardKeys.add(cardKey)

    const matchingProductIds = matchProductIds({ city, country }, products, cityLabels, countryLabels)
    const { nights, days } = resolveTripDuration(r, matchingProductIds, products)
    const monthLabel =
      typeof r.monthLabel === 'string' && r.monthLabel.trim()
        ? r.monthLabel.trim()
        : monthLabelFromNumber(month)

    let events: TripRecommendationEvent[] = []
    try {
      // REGRESSION-FREEZE[trip-rec-curation-event-city-match]: 카드 city 전달 — manifest
      const matched = await getGlobalEventsForRecommendationMonth(month, country, {
        countryLabels,
        referenceDate: now,
        city,
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
      reason: truncateReason(String(r.reason ?? '')),
      recommendedTripNights: nights,
      recommendedTripDays: days,
      themes: Array.isArray(r.themes)
        ? r.themes.map(String).filter(Boolean).slice(0, 2)
        : undefined,
      matchingProductIds,
      events: events.length ? events : undefined,
      season: monthToSeason(month),
      monthRange: monthLabel,
    })
  }

  if (eventLookupFailed) {
    debugLog('trip-recommend', 'some recommendation event lookups failed')
  }

  if (!enriched.length) {
    errorDetails.push({
      stage: 'empty_batch',
      message: '파싱된 raw 추천은 있으나 유효 카드 0개 — month/country 필터',
    })
    throw new Error(`trip_recommend_empty: ${JSON.stringify({ errorDetails })}`)
  }

  const startMonth = currentMonth

  return {
    generatedAt: now.toISOString(),
    windowMonths: 12,
    startMonth,
    recommendations: enriched,
    totalProductsAnalyzed: products.length,
    errorDetails: errorDetails.length ? errorDetails : undefined,
  }
}
