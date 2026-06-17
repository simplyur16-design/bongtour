import { generateGeminiJsonResponse } from '@/lib/bong-marketing/gemini-generate'
import { ensureRequiredHashtags } from '@/lib/bong-marketing/bongtour-brand-guide'

const CAPTION_MODEL = (process.env.CARD_NEWS_GEMINI_MODEL || 'gemini-2.5-pro').trim()

export interface CaptionGenerationInput {
  episodeType: 'package' | 'tip' | 'caution'
  city: string
  country: string
  season?: string
  themes?: string[]
  slideHighlights: string[]
  productName?: string
}

export interface CaptionResult {
  caption: string
  hashtags: string[]
}

function buildCaptionSystemPrompt(input: CaptionGenerationInput): string {
  const regionTag = input.city || input.country || '여행'
  return `
당신은 Bong투어의 인스타그램 카드뉴스 캡션 작성자입니다.

## 회사명 표기 — 반드시 "Bong투어"
- 본문에는 "Bong투어"로 표기
- 한글 "봉투어" 단독 사용 X (해시태그에서만 #봉투어 사용)

## 가이드 언급 금지
- "가이드"라는 단어 사용 금지

## 캡션
- 1-2문장, ~해요체, 친근하지만 정중
- 카드뉴스 5장을 본 후 액션 유도 (저장·DM·링크 클릭)
- 패키지 편이면 봉심 eSIM 혜택 자연스럽게 언급 가능

## 해시태그 정확히 5개
- 1번 위치: #봉투어 (필수)
- 2번 위치: #Bong투어 (필수)
- 3번: #${regionTag} 또는 지역 해시태그
- 4-5번: 테마 / Bong투어 차별점 (#봉심eSIM, #큐레이션여행 등)

금지:
- "최고/유일/100%/완벽/절대/최저가" 등 단정형 (광고법)
- "여러분~", "함께 알아볼까요?" 같은 AI 클리셰
- 6개 이상 해시태그
- 캡션 3문장 초과

응답 형식 (JSON):
{
  "caption": "1-2문장",
  "hashtags": ["#봉투어", "#Bong투어", "#XXX", "#XXX", "#XXX"]
}
`.trim()
}

export function parseCaptionResponse(response: unknown): CaptionResult {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid caption generation response')
  }
  const row = response as { caption?: unknown; hashtags?: unknown }
  const caption = typeof row.caption === 'string' ? row.caption.trim() : ''
  if (!caption) throw new Error('Invalid caption generation response')

  const rawTags = Array.isArray(row.hashtags)
    ? row.hashtags
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter(Boolean)
    : []

  const hashtags = ensureRequiredHashtags(rawTags, 5, [
    '#여행',
    '#해외여행',
    '#큐레이션여행',
  ])

  return { caption, hashtags }
}

export async function generateEpisodeCaption(
  input: CaptionGenerationInput,
): Promise<CaptionResult> {
  const systemPrompt = buildCaptionSystemPrompt(input)
  const userPrompt = `
편 유형: ${input.episodeType}
도시: ${input.city}
국가: ${input.country}
${input.season ? `시즌: ${input.season}` : ''}
${input.themes?.length ? `테마: ${input.themes.join(', ')}` : ''}
${input.productName ? `연결 상품: ${input.productName}` : ''}

슬라이드 헤드라인:
${input.slideHighlights.map((h, i) => `${i + 1}. ${h}`).join('\n')}

위 내용으로 인스타 캡션 + 해시태그 5개를 생성하세요.
`.trim()

  const response = await generateGeminiJsonResponse({
    model: CAPTION_MODEL,
    systemPrompt,
    userPrompt,
    maxOutputTokens: 1024,
  })

  return parseCaptionResponse(response)
}
