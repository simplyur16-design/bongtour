import { generateGeminiJsonResponse } from '@/lib/bong-marketing/gemini-generate'

const CITY_RECOMMEND_MODEL = (process.env.CARD_NEWS_GEMINI_MODEL || 'gemini-2.5-pro').trim()

export interface CityRecommendationInput {
  themeTitle: string
  season: string | null
  tripNights: number
  tripDays: number
  themeIntent?: string
  customKeywords?: string
  count?: number
}

export interface CityRecommendation {
  cities: string[]
  reasoning?: string
}

export async function recommendCities(input: CityRecommendationInput): Promise<CityRecommendation> {
  const count = input.count ?? 4
  const systemPrompt = `
당신은 봉투어의 여행 큐레이터입니다.
주어진 테마/시즌/일정 조건에 맞는 한국인 여행객 인기 해외 도시를 인기 순으로 추천하세요.

규칙:
- 추천 도시는 ${count}개
- ${input.tripNights}박 ${input.tripDays}일에 적합한 도시만
- 인기 순서대로 정렬 (대표 도시 우선)
- 봉투어가 운영 가능한 일반적인 해외 인기 여행지 (일본, 동남아, 유럽, 미주 등)
- JSON 형식만 반환

응답 형식:
{
  "cities": ["도시1", "도시2", "도시3", "도시4"],
  "reasoning": "선정 이유 짧게"
}
`.trim()

  const userPrompt = `
테마: ${input.themeTitle}
시즌: ${input.season ?? '연중'}
일정: ${input.tripNights}박 ${input.tripDays}일
${input.themeIntent ? `운영자 의도: ${input.themeIntent}` : ''}
${input.customKeywords ? `운영자 키워드: ${input.customKeywords}` : ''}
`.trim()

  const response = await generateGeminiJsonResponse<{
    cities?: unknown
    reasoning?: unknown
  }>({
    model: CITY_RECOMMEND_MODEL,
    systemPrompt,
    userPrompt,
    maxOutputTokens: 1024,
  })

  const cities = Array.isArray(response.cities)
    ? response.cities.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).map((c) => c.trim())
    : []

  return {
    cities,
    reasoning: typeof response.reasoning === 'string' ? response.reasoning : undefined,
  }
}
