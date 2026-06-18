/**
 * Gemini JSON 응답 생성 헬퍼.
 *
 * 봉투어 기존 인프라(`gemini-client` + `gemini-json-parse`)를 그대로 재활용해
 * `{ model, systemPrompt, userPrompt, maxOutputTokens }` 시그니처로 JSON 객체를 돌려준다.
 * 새 LLM 클라이언트를 만들지 않으며, `gemini-json-parse.ts` 는 변경하지 않는다.
 *
 * - systemPrompt → `systemInstruction`
 * - userPrompt   → 단일 user content
 * - 응답은 `responseMimeType: 'application/json'` 강제 + `parseGeminiJsonOutput` 완화 파싱
 * - 파싱 실패 시 1회 재시도(temperature 살짝 낮춤) 후에도 실패하면 throw
 */
import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import { parseGeminiJsonOutput } from '@/lib/bong-marketing/gemini-json-parse'

export interface GenerateGeminiJsonParams {
  /** 모델명. 비우면 getModelName() (기본 flash). 카드뉴스는 'gemini-2.5-pro' 권장 */
  model?: string
  systemPrompt: string
  userPrompt: string
  /** 기본 4096. Gemini 2.5 Pro는 최대 65536 출력 토큰 지원 */
  maxOutputTokens?: number
  /** 기본 0.7 */
  temperature?: number
  /** generateContent 타임아웃(ms). 기본 120초 */
  timeoutMs?: number
}

/**
 * Gemini 를 호출해 원문 텍스트를 반환한다 (JSON 파싱 없음).
 */
export async function generateGeminiTextResponse(params: GenerateGeminiJsonParams): Promise<string> {
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY(또는 GOOGLE_API_KEY) 미설정')
  }

  const modelId = (params.model?.trim() || getModelName()).trim()
  const maxOutputTokens = params.maxOutputTokens ?? 4096
  const temperature = params.temperature ?? 0.7
  const timeoutMs = params.timeoutMs ?? 120_000

  const model = getGenAI().getGenerativeModel({
    model: modelId,
    systemInstruction: params.systemPrompt,
  })

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

  return result.response.text()
}

/**
 * Gemini 를 호출해 JSON 객체를 파싱해 반환한다.
 * 키 미설정·생성 실패·파싱 실패 시 Error 를 throw 한다(호출 측에서 잡아 상태 롤백).
 */
export async function generateGeminiJsonResponse<T = Record<string, unknown>>(
  params: GenerateGeminiJsonParams,
): Promise<T> {
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY(또는 GOOGLE_API_KEY) 미설정')
  }

  const modelId = (params.model?.trim() || getModelName()).trim()
  const maxOutputTokens = params.maxOutputTokens ?? 4096
  const baseTemperature = params.temperature ?? 0.7
  const timeoutMs = params.timeoutMs ?? 120_000

  const model = getGenAI().getGenerativeModel({
    model: modelId,
    systemInstruction: params.systemPrompt,
  })

  let lastRawPreview = ''
  let lastError = 'unknown'

  for (let attempt = 1; attempt <= 2; attempt++) {
    const temperature = attempt === 1 ? baseTemperature : Math.max(0.3, baseTemperature - 0.1)
    let text: string
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
      text = result.response.text()
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
      if (attempt === 2) throw new Error(`gemini_generate_failed: ${lastError}`)
      continue
    }

    lastRawPreview = text.slice(0, 500)
    const pj = parseGeminiJsonOutput(text)
    if (pj.ok) {
      return pj.value as T
    }
    lastError = pj.error
    if (attempt === 2) {
      throw new Error(`gemini_parse_failed_after_retry: ${pj.error} | preview: ${lastRawPreview}`)
    }
  }

  // 도달 불가(루프 내에서 항상 return/throw) — 타입 안전용
  throw new Error(`gemini_generate_unreachable: ${lastError}`)
}
