import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import { parseGeminiJsonOutput } from '@/lib/bong-marketing/gemini-json-parse'
import { debugLog } from '@/lib/bong-marketing/debug-log'
import { stripHtmlTags, type NaverBlogSearchItem } from '@/lib/bong-marketing/naver-search-client'

const HOOK_EXTRACT_MODEL = (process.env.CARD_NEWS_GEMINI_MODEL || 'gemini-2.5-pro').trim()

export interface ExtractedHook {
  hookText: string
  hookType: 'good' | 'bad'
  category?: string
  context?: string
  source?: string
  tags?: string[]
  reasoning?: string
}

function buildHookExtractorSystemPrompt(): string {
  return `
당신은 봉투어의 후킹 카피 큐레이터입니다.
주어진 블로그 글 제목과 도입부에서 후킹 카피를 추출하고 모범/금지로 분류합니다.

규칙:
- 후킹 카피 = 독자 시선을 즉시 끄는 한 줄 또는 짧은 문장
- 좋은 후킹 (good) = 숫자/반전/비주얼/희소성/시간/공감/질문형
  예: "도시의 빛이 닿지 않는 밤", "30대 직장인 진짜 쉬는 4박 5일", "5만원으로 하루 살기"
- 나쁜 후킹 (bad) = AI 클리셰, 평이한 정보 나열, 단정형, 진부한 표현
  예: "여러분, 오늘은 ~에 대해 알아보겠습니다", "함께 알아볼까요?", "최고의 여행지를 소개합니다"
- 광고법 위반 표현(최고/유일/100%/완벽/절대)은 자동 bad

응답 형식 (JSON):
{
  "hooks": [
    {
      "hookText": "후킹 카피 원문 (15-40자)",
      "hookType": "good" | "bad",
      "category": "package" | "tip" | "season" | "comparison" | "emotion" | "etc",
      "tags": ["다낭", "여름", "휴양"],
      "reasoning": "분류 이유 한 줄"
    }
  ]
}

금지:
- 30자 초과 카피 X (후킹은 짧아야 함)
- 단순 정보 나열은 후킹 아님 (제외)
- 같은 글에서 후킹 1-3개만 추출 (양보다 질)
`.trim()
}

async function callGeminiHookExtractor(
  params: {
    systemPrompt: string
    userPrompt: string
  },
): Promise<unknown> {
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY(또는 GOOGLE_API_KEY) 미설정')
  }

  const modelId = HOOK_EXTRACT_MODEL || getModelName()
  const maxOutputTokens = 8192
  const timeoutMs = 180_000

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
      debugLog('hook-extract', 'gemini raw (1000):', lastRawResponseText.slice(0, 1000))

      const pj = parseGeminiJsonOutput(lastRawResponseText)
      if (pj.ok) {
        return pj.value
      }

      debugLog('hook-extract', 'gemini raw (full, json parse fail):', lastRawResponseText)
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

export function parseHookExtractorResponse(response: unknown, queryKeyword: string): ExtractedHook[] {
  if (!response || typeof response !== 'object') {
    throw new Error('Gemini 후킹 추출 응답 형식 오류')
  }
  const hooks = (response as { hooks?: unknown }).hooks
  if (!Array.isArray(hooks)) {
    throw new Error('Gemini 후킹 추출 응답 형식 오류')
  }

  const parsed: ExtractedHook[] = []
  for (const h of hooks) {
    if (!h || typeof h !== 'object') continue
    const row = h as Record<string, unknown>
    const hookText = String(row.hookText ?? '').trim()
    if (!hookText || hookText.length > 50) continue
    parsed.push({
      hookText,
      hookType: row.hookType === 'bad' ? 'bad' : 'good',
      category: row.category ? String(row.category) : undefined,
      tags: Array.isArray(row.tags) ? row.tags.map(String).filter(Boolean) : [],
      reasoning: row.reasoning ? String(row.reasoning) : undefined,
      source: 'naver_blog_search',
      context: `네이버 블로그 검색: "${queryKeyword}"`,
    })
  }
  return parsed
}

export async function extractHooksFromBlogItems(
  items: NaverBlogSearchItem[],
  queryKeyword: string,
): Promise<ExtractedHook[]> {
  if (items.length === 0) return []

  const CHUNK_SIZE = 20 // (운영) 한 번에 60개를 넣으면 응답이 무거워질 수 있어 20개 단위로 분할
  const systemPrompt = buildHookExtractorSystemPrompt()

  const chunks: NaverBlogSearchItem[][] = []
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    chunks.push(items.slice(i, i + CHUNK_SIZE))
  }

  const allParsed: ExtractedHook[] = []

  for (const chunk of chunks) {
    const sanitized = chunk.map((item, idx) => ({
      idx,
      title: stripHtmlTags(item.title),
      description: stripHtmlTags(item.description),
      bloggername: item.bloggername,
      postdate: item.postdate,
    }))

    const userPrompt = `
검색 키워드: ${queryKeyword}
블로그 글 ${sanitized.length}개에서 후킹 카피를 추출하고 분류해줘.

블로그 글 목록:
${sanitized.map((s) => `[${s.idx}] 제목: ${s.title}\n    도입부: ${s.description}`).join('\n\n')}
`.trim()

    const response = await callGeminiHookExtractor({ systemPrompt, userPrompt })
    allParsed.push(...parseHookExtractorResponse(response, queryKeyword))
  }

  return allParsed
}
