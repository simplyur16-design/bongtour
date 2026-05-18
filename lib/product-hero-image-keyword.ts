/**
 * 상품 대표 이미지(bgImageUrl) Pexels 검색용 — 일정 imageKeyword 중 가장 유명한 관광지 1개.
 */

import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import { pickHighestPriorityLandmark } from '@/lib/famous-landmarks-priority'
import { mapDestination } from '@/lib/pexels-keyword'
import { normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'

export type ProductHeroPlaceKeywordSource =
  | 'llm'
  | 'priority_map'
  | 'first_day'
  | 'city_fallback'
  | 'country_fallback'
  | 'cache'

export type ProductHeroItineraryDayInput = {
  day: number
  imageKeyword: string
  poiNamesRaw?: string
  summaryText?: string
}

export type SelectProductHeroPlaceKeywordInput = {
  productId: string
  itineraryDays: ProductHeroItineraryDayInput[]
  cityEn?: string
  countryEn?: string
  destinationKr?: string
  /** `bgImageRehostSearchLabel` 등에 저장된 영문 장소명 — 재계산 생략 */
  cachedHeroPlaceKeyword?: string | null
}

export type SelectProductHeroPlaceKeywordResult = {
  keyword: string
  source: ProductHeroPlaceKeywordSource
  reasoning?: string
}

const GEMINI_TIMEOUT_MS = 25_000

function resolveCityCountryEn(input: SelectProductHeroPlaceKeywordInput): {
  cityEn: string
  countryEn: string
} {
  const cityEn = (input.cityEn ?? mapDestination(input.destinationKr ?? null) ?? '').trim()
  const countryEn = (input.countryEn ?? '').trim()
  return { cityEn, countryEn }
}

async function selectViaLlm(input: {
  destinationKr?: string
  cityEn: string
  countryEn: string
  days: Array<{ day: number; keyword: string }>
}): Promise<{ keyword: string; reasoning?: string } | null> {
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey || input.days.length === 0) return null

  const listJson = JSON.stringify(input.days)
  const prompt = [
    '다음은 한 여행상품의 일정별 관광지 영문명 리스트입니다:',
    listJson,
    '',
    `상품: ${input.destinationKr ?? ''} (${input.cityEn}, ${input.countryEn})`,
    '',
    '한국인 일반 여행객이 이 상품을 봤을 때 "이거 가고 싶다"고 느끼게 만들',
    '가장 대표적이고 인지도 높은 관광지 1개의 영문명만 출력하세요.',
    '- 응답: 단일 영문 관광지명만 (예: Osaka Castle)',
    '- 부가 설명·따옴표·JSON 금지',
  ].join('\n')

  try {
    const genAI = getGenAI()
    const model = genAI.getGenerativeModel({ model: getModelName() })
    const result = await model.generateContent(
      { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
      geminiTimeoutOpts(GEMINI_TIMEOUT_MS),
    )
    const raw = result.response.text().trim()
    const firstLine = raw.split('\n')[0]?.replace(/^["'`]+|["'`]+$/g, '').trim() ?? ''
    const kw = normalizeToPlaceName(firstLine)
    if (!kw) return null
    return { keyword: kw, reasoning: raw.length > kw.length + 2 ? raw.slice(0, 200) : undefined }
  } catch (err) {
    console.warn('[product-hero-image-keyword] LLM selection failed', err)
    return null
  }
}

/**
 * 상품 대표 이미지 Pexels 검색 키워드 선정.
 */
export async function selectProductHeroPlaceKeyword(
  input: SelectProductHeroPlaceKeywordInput,
): Promise<SelectProductHeroPlaceKeywordResult> {
  const cached = normalizeToPlaceName(input.cachedHeroPlaceKeyword ?? '')
  if (cached) {
    return { keyword: cached, source: 'cache' }
  }

  const { cityEn, countryEn } = resolveCityCountryEn(input)

  const normalizedDays = input.itineraryDays
    .map((d) => ({
      day: d.day,
      keyword: normalizeToPlaceName(d.imageKeyword),
    }))
    .filter((d) => d.keyword.length > 0)

  if (normalizedDays.length === 0) {
    if (cityEn) return { keyword: normalizeToPlaceName(cityEn) || cityEn, source: 'city_fallback' }
    if (countryEn) return { keyword: normalizeToPlaceName(countryEn) || countryEn, source: 'country_fallback' }
    return { keyword: '', source: 'city_fallback' }
  }

  const llmPick = await selectViaLlm({
    destinationKr: input.destinationKr,
    cityEn,
    countryEn,
    days: normalizedDays,
  })
  if (llmPick?.keyword) {
    return { keyword: llmPick.keyword, source: 'llm', reasoning: llmPick.reasoning }
  }

  const priority = pickHighestPriorityLandmark(
    normalizedDays.map((d) => d.keyword),
    (s) => normalizeToPlaceName(s),
  )
  if (priority?.keyword) {
    return { keyword: priority.keyword, source: 'priority_map' }
  }

  const first = normalizedDays.sort((a, b) => a.day - b.day)[0]
  if (first?.keyword) {
    return { keyword: first.keyword, source: 'first_day' }
  }

  if (cityEn) return { keyword: normalizeToPlaceName(cityEn) || cityEn, source: 'city_fallback' }
  if (countryEn) return { keyword: normalizeToPlaceName(countryEn) || countryEn, source: 'country_fallback' }
  return { keyword: '', source: 'city_fallback' }
}

/** schedule JSON + itinerary rows → 선정 입력 */
export function buildHeroKeywordInputsFromSchedule(
  scheduleJson: string | null | undefined,
  itineraryRows?: Array<{ day: number; poiNamesRaw?: string | null; summaryTextRaw?: string | null }>,
): ProductHeroItineraryDayInput[] {
  const byDay = new Map<number, ProductHeroItineraryDayInput>()
  if (scheduleJson?.trim()) {
    try {
      const arr = JSON.parse(scheduleJson) as unknown
      if (Array.isArray(arr)) {
        for (const item of arr) {
          const o = item as Record<string, unknown>
          const day = Number(o.day)
          if (!Number.isFinite(day) || day < 1) continue
          byDay.set(day, {
            day,
            imageKeyword: String(o.imageKeyword ?? '').trim(),
          })
        }
      }
    } catch {
      /* ignore */
    }
  }
  for (const row of itineraryRows ?? []) {
    const prev = byDay.get(row.day)
    byDay.set(row.day, {
      day: row.day,
      imageKeyword: prev?.imageKeyword ?? '',
      poiNamesRaw: row.poiNamesRaw ?? undefined,
      summaryText: row.summaryTextRaw ?? undefined,
    })
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day)
}
