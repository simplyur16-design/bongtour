import { prisma } from '@/lib/prisma'
import { generateGeminiJsonResponse } from '@/lib/bong-marketing/gemini-generate'
import {
  buildBrandGuide,
  detectIdentityViolations,
  ensureRequiredHashtags,
} from '@/lib/bong-marketing/bongtour-brand-guide'
import { debugWarn } from '@/lib/bong-marketing/debug-log'

export const BLOG_GENERATION_PROMPT_VERSION = 'blog-v1.3'
export const BLOG_FROM_SERIES_PROMPT_VERSION = 'blog-v1.3-from-series'

const BLOG_GENERATION_MODEL = (process.env.CARD_NEWS_GEMINI_MODEL || 'gemini-2.5-pro').trim()

export type BlogContentTrack = 'package' | 'airtel'

export interface BlogGenerationInput {
  city: string
  country: string
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  monthRange: string
  urgency: string
  reason: string
  themes?: string[]
  recommendedTripNights?: number
  recommendedTripDays?: number
  matchingProductIds: string[]
  contentTrack: BlogContentTrack
}

export interface BlogGenerationResult {
  title: string
  excerpt: string
  body: string
  hashtags: string[]
}

export interface SeriesEpisodeContext {
  episodeType: 'package' | 'tip' | 'caution'
  title: string
  slides: Array<{
    headline: string
    subtitle?: string | null
    body?: string | null
  }>
}

export interface BlogFromSeriesInput {
  seriesId: string
  contentTrack: BlogContentTrack
}

export interface SeriesBlogPromptContext {
  themeTitle: string
  selectedCities: string[]
  tripNights: number | null
  tripDays: number | null
  season: string | null
}

const TRACK_KOR: Record<BlogContentTrack, string> = {
  package: '패키지 여행',
  airtel: '자유여행 (항공+호텔)',
}

export function buildBlogSystemPrompt(
  track: BlogContentTrack,
  hasSeriesContext = false,
): string {
  const brandGuide = buildBrandGuide(track)

  const diffSection =
    track === 'package'
      ? '⭐ Bong투어 차별점 (## 헤딩) - "Bong투어 추천상품" + "여행사의 모든 혜택을 다 챙겨드립니다" + ⭐ 무제한 봉심 eSIM. "Bong투어가 만들었다" X, "Bong투어가 골랐다" 톤. 300-500자.'
      : '⭐ Bong투어를 통한 예약 장점 (## 헤딩) - 큐레이션 + "여행사의 모든 혜택을 다 챙겨드립니다". eSIM 자동 포함 X, 봉심 별도 안내 가능. 300-500자.'

  const tipSection = hasSeriesContext
    ? '- 시리즈의 여행팁 편 슬라이드 본문을 자연스럽게 통합해서 풀어쓰기'
    : '- 도시·국가 특성에 맞는 실용 정보: 짐 싸기, 환전, 데이터, 입국, 교통, 식사 등'

  const cautionSection = hasSeriesContext
    ? '- 시리즈의 주의사항 편 슬라이드 본문을 자연스럽게 통합해서 풀어쓰기'
    : '- 비자, 안전, 문화 차이, 분실 대비, 시즌 변화 등'

  const packageExtra =
    track === 'package'
      ? `
## ⭐ 무제한 eSIM 어필 (7번 단락에서)
"Bong투어에서 이 패키지 예약하시면 여행 기간 동안 무제한 데이터를 쓸 수 있는 봉심 eSIM을 성인 1인당 1개씩 무료로 드려요. 모든 나라에서 사용할 수 있고 추가 비용도 없습니다."

## ⚠️ Bong투어 정체성 — 절대 위반 X
- "Bong투어 큐레이터가 일정 설계" ❌
- "Bong투어 전문 가이드" ❌ ("가이드" 단어 자체 금지)
- "Bong투어가 호텔을 엄선" ❌
- "Bong투어 자체 식단" ❌

대신:
- "Bong투어 추천상품이에요"
- "이 패키지의 호텔은 시내 중심부에 위치해요"
- "이 상품에는 신선한 해산물·수프카레가 포함돼요"
`.trim()
      : ''

  return `
당신은 Bong투어의 네이버 블로그 작가입니다.

${brandGuide}

## 회사명 표기 — 반드시 "Bong투어"
- 제목·본문·excerpt 모두 "Bong투어"로 표기
- 한글 "봉투어" 단독 사용 X
- 해시태그에서만 #봉투어 + #Bong투어 둘 다 사용

## 가이드 언급 금지
- "가이드"라는 단어를 카피에 절대 사용하지 마세요

## 블로그 작성 사양

### 제목 (title) — 필수, 20자 이내, 후킹 톤
### 메타 디스크립션 (excerpt) — 필수, 80-120자
### 본문 (body) — 필수, 4000-5000자, 마크다운 H2 헤딩 8개

### 해시태그 (hashtags) — 정확히 20개
- 1번 위치: #봉투어 (필수)
- 2번 위치: #Bong투어 (필수)
- 3-7: 도시·국가 (5개)
- 8-10: 시즌·이벤트 (3개)
- 11-15: 테마 (5개)
- 16-19: 대중 검색 (4개)
- 20: 차별점 (#봉심eSIM, #Bong투어큐레이션 등)

## 블로그 8단락 구조

1. 도입 (공감 후크) - 200-300자
2. 도시·국가 소개 (## 헤딩) - 500-800자
3. ${track === 'package' ? '패키지 추천 이유 (## 헤딩)' : '자유여행 매력 (## 헤딩)'} - 500-800자
4. 추천 일정/조합 (## 헤딩) - 500-800자
5. ⭐ 여행 꿀팁 (## 헤딩) - 400-600자
   ${tipSection}
   - 구체적이고 실용적, 추상적 X
6. ⭐ 알아두면 좋은 점 (## 헤딩) - 400-600자
   ${cautionSection}
   - 부정적 톤 X, 정보 제공 톤
7. ${diffSection}
8. 마무리 CTA - 200-300자

${packageExtra}

## 금지
- "최고/유일/100%/완벽/절대/최저가" 단정형 (광고법)
- "여러분~", "함께 알아볼까요?", "오늘은 ~에 대해 알아보겠습니다" AI 클리셰
- 가격 단정, 경쟁사 직접 비방

## 응답 형식 (JSON)
{
  "title": "20자 이내 제목 (Bong투어 표기)",
  "excerpt": "80-120자",
  "body": "마크다운 본문 (4000-5000자, H2 헤딩 8개)",
  "hashtags": ["#봉투어", "#Bong투어", "... 총 20개"]
}
`.trim()
}

export function buildBlogUserPrompt(input: BlogGenerationInput): string {
  return `
도시: ${input.city}
국가: ${input.country}
시즌: ${input.season}
시점: ${input.monthRange} (${input.urgency})
추천 이유: ${input.reason}
${input.themes?.length ? `테마: ${input.themes.join(', ')}` : ''}
${input.recommendedTripNights && input.recommendedTripDays ? `추천 일정: ${input.recommendedTripNights}박 ${input.recommendedTripDays}일` : ''}
콘텐츠 트랙: ${TRACK_KOR[input.contentTrack]}

위 정보를 바탕으로 네이버 블로그용 글 8단락을 작성해주세요.
5번 단락(여행 꿀팁)과 6번 단락(알아두면 좋은 점)은 도시·국가 특성에 맞게 Gemini가 직접 작성하세요.
${
  input.contentTrack === 'package'
    ? 'Bong투어 추천 패키지의 장점(검증된 큐레이션·여행사 혜택·봉심 eSIM)을 자연스럽게 녹이세요. Bong투어가 상품을 만든 것처럼 쓰지 마세요.'
    : 'Bong투어 자유여행(항공+호텔) 상품의 장점(검증된 조합·여행사 혜택)을 자연스럽게 녹이세요. eSIM은 자동 포함되지 않습니다.'
}
`.trim()
}

export function buildSeriesUserPrompt(
  series: SeriesBlogPromptContext,
  episodes: SeriesEpisodeContext[],
): string {
  const lines: string[] = []

  lines.push('## 시리즈 정보')
  lines.push(`- 테마: ${series.themeTitle}`)
  lines.push(`- 도시: ${series.selectedCities.join(', ')}`)
  if (series.tripNights && series.tripDays) {
    lines.push(`- 일정: ${series.tripNights}박 ${series.tripDays}일`)
  }
  if (series.season) lines.push(`- 시즌: ${series.season}`)

  lines.push('')
  lines.push('## 카드뉴스 시리즈 편 본문 (이 정보를 블로그 글에 자연스럽게 통합하세요)')

  for (const ep of episodes) {
    lines.push('')
    lines.push(`### [${ep.episodeType}] ${ep.title}`)
    for (const slide of ep.slides) {
      lines.push(`- ${slide.headline}${slide.subtitle ? ` (${slide.subtitle})` : ''}`)
      if (slide.body) lines.push(`  ${slide.body}`)
    }
  }

  lines.push('')
  lines.push('위 시리즈의 정보를 바탕으로 블로그 글 8단락을 작성하세요.')
  lines.push('특히 5번 단락(여행 꿀팁)에는 [tip] 편의 본문을, 6번 단락(알아두면 좋은 점)에는 [caution] 편의 본문을 자연스럽게 통합하세요.')
  lines.push('단순 복사 X, 블로그 톤으로 재작성하면서 정보는 모두 살리세요.')

  return lines.join('\n')
}

export function parseBlogHashtags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .map((t) => (t.startsWith('#') ? t.trim() : `#${t.trim()}`))
}

export function finalizeBlogHashtags(raw: unknown): string[] {
  return ensureRequiredHashtags(parseBlogHashtags(raw), 20, [
    '#여행',
    '#해외여행',
    '#여행스타그램',
    '#큐레이션여행',
  ])
}

export function validateBlogBrandIdentity(generated: BlogGenerationResult): void {
  const bodyText = [generated.title, generated.excerpt, generated.body].join('\n')
  const violations = detectIdentityViolations(bodyText)
  if (violations.length > 0) {
    debugWarn('brand-identity', '블로그 정체성 위반 감지:', violations)
  }
}

function parseBlogGeminiResponse(response: {
  title?: unknown
  excerpt?: unknown
  body?: unknown
  hashtags?: unknown
}): BlogGenerationResult {
  const title = typeof response.title === 'string' ? response.title.trim() : ''
  const body = typeof response.body === 'string' ? response.body.trim() : ''
  if (!title || !body) {
    throw new Error('Invalid Gemini response: title or body missing')
  }

  const result: BlogGenerationResult = {
    title,
    excerpt: typeof response.excerpt === 'string' ? response.excerpt.trim() : '',
    body,
    hashtags: finalizeBlogHashtags(response.hashtags),
  }

  validateBlogBrandIdentity(result)
  return result
}

export async function generateBlogPost(input: BlogGenerationInput): Promise<BlogGenerationResult> {
  const response = await generateGeminiJsonResponse<{
    title?: unknown
    excerpt?: unknown
    body?: unknown
    hashtags?: unknown
  }>({
    model: BLOG_GENERATION_MODEL,
    systemPrompt: buildBlogSystemPrompt(input.contentTrack, false),
    userPrompt: buildBlogUserPrompt(input),
    maxOutputTokens: 8192,
    timeoutMs: 240_000,
  })

  return parseBlogGeminiResponse(response)
}

export async function generateBlogPostFromSeries(
  input: BlogFromSeriesInput,
): Promise<BlogGenerationResult> {
  const series = await prisma.bongCardNewsSeries.findUnique({
    where: { id: input.seriesId },
    include: {
      episodes: {
        orderBy: { episodeNumber: 'asc' },
        include: {
          slides: { orderBy: { slideNumber: 'asc' } },
          linkedProduct: { select: { id: true, title: true, country: true, city: true } },
        },
      },
    },
  })

  if (!series) {
    throw new Error('시리즈를 찾을 수 없습니다.')
  }

  const episodeContexts: SeriesEpisodeContext[] = series.episodes.map((ep) => ({
    episodeType: ep.episodeType as 'package' | 'tip' | 'caution',
    title: ep.title,
    slides: ep.slides.map((s) => ({
      headline: s.headline,
      subtitle: s.subtitle,
      body: s.body,
    })),
  }))

  const systemPrompt = buildBlogSystemPrompt(input.contentTrack, true)
  const userPrompt = buildSeriesUserPrompt(
    {
      themeTitle: series.themeTitle,
      selectedCities: series.selectedCities,
      tripNights: series.tripNights,
      tripDays: series.tripDays,
      season: series.season,
    },
    episodeContexts,
  )

  const response = await generateGeminiJsonResponse<{
    title?: unknown
    excerpt?: unknown
    body?: unknown
    hashtags?: unknown
  }>({
    model: BLOG_GENERATION_MODEL,
    systemPrompt,
    userPrompt,
    maxOutputTokens: 8192,
    timeoutMs: 240_000,
  })

  return parseBlogGeminiResponse(response)
}
