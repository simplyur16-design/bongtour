import { buildBongtourProductTitlePrompt, type BongtourProductTitleLlmInput } from '@/lib/bongtour-product-title-llm-prompt'
import {
  sanitizeBongtourProductTitle,
  validateBongtourProductTitle,
  type BongtourProductTitleValidationResult,
} from '@/lib/bongtour-product-title-tone-ssot'
import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import { parseLlmJsonObject } from '@/lib/llm-json-extract'

function envFlag(name: string, defaultTrue: boolean): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase()
  if (!v) return defaultTrue
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false
  return true
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function envFloat(name: string, fallback: number): number {
  const n = Number(process.env[name])
  return Number.isFinite(n) ? n : fallback
}

function titleModelName(): string {
  const m = (process.env.BONGTOUR_PRODUCT_TITLE_LLM_MODEL ?? '').trim()
  return m || getModelName()
}

function hasGeminiKey(): boolean {
  return Boolean((process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim())
}

type GenerateResult = {
  title: string | null
  originalTitle: string
  validation: BongtourProductTitleValidationResult
  source: 'llm' | 'llm_retry' | 'fallback_disabled' | 'fallback_no_key' | 'fallback_error' | 'fallback_invalid'
}

async function callGeminiTitleOnce(
  input: BongtourProductTitleLlmInput,
  temperature: number
): Promise<string | null> {
  const { systemPrompt, userPrompt } = buildBongtourProductTitlePrompt(input)
  const genAI = getGenAI()
  const model = genAI.getGenerativeModel({ model: titleModelName() })
  const timeoutMs = envInt('BONGTOUR_PRODUCT_TITLE_LLM_TIMEOUT_MS', 30_000)
  const combined = `${systemPrompt}\n\n---\n\n${userPrompt}`
  const res = await model.generateContent(
    {
      contents: [{ role: 'user', parts: [{ text: combined }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: 256,
        ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }),
      },
    },
    geminiTimeoutOpts(Math.min(timeoutMs, 120_000))
  )
  const text = res.response.text()
  const o = parseLlmJsonObject<{ title?: unknown }>(text, { logLabel: 'bongtour-product-title' })
  const t = typeof o.title === 'string' ? o.title.trim() : ''
  return t ? t : null
}

/**
 * 미리보기 단계에서 봉투어 톤 상품명 1줄 생성. 실패해도 예외를 밖으로 던지지 않는다.
 */
export async function generateBongtourProductTitle(input: BongtourProductTitleLlmInput): Promise<GenerateResult> {
  const originalTitle = (input.originalProductTitle || '').trim() || '미입력'
  const emptyValidation = validateBongtourProductTitle('')

  if (!envFlag('BONGTOUR_PRODUCT_TITLE_LLM_ENABLED', true)) {
    console.info('[bongtour-product-title] skipped: BONGTOUR_PRODUCT_TITLE_LLM_ENABLED=0')
    return {
      title: null,
      originalTitle,
      validation: emptyValidation,
      source: 'fallback_disabled',
    }
  }
  if (!hasGeminiKey()) {
    console.warn('[bongtour-product-title] skipped: no GEMINI_API_KEY/GOOGLE_API_KEY')
    return {
      title: null,
      originalTitle,
      validation: emptyValidation,
      source: 'fallback_no_key',
    }
  }

  const maxRetry = envInt('BONGTOUR_PRODUCT_TITLE_LLM_RETRY_MAX', 1)
  const t0 = envFloat('BONGTOUR_PRODUCT_TITLE_LLM_TEMPERATURE', 0.3)
  const t1 = Math.min(0.9, t0 + 0.12)

  const attempt = async (temp: number, label: 'llm' | 'llm_retry'): Promise<GenerateResult | null> => {
    try {
      const raw = await callGeminiTitleOnce(input, temp)
      if (!raw) return null
      const cleaned = sanitizeBongtourProductTitle(raw)
      const validation = validateBongtourProductTitle(cleaned)
      if (validation.ok) {
        console.info('[bongtour-product-title]', { ok: true, source: label, charLength: validation.charLength })
        return { title: cleaned, originalTitle, validation, source: label }
      }
      console.warn('[bongtour-product-title]', { ok: false, source: label, issues: validation.issues })
      return { title: null, originalTitle, validation, source: 'fallback_invalid' }
    } catch (e) {
      console.warn('[bongtour-product-title]', label, e instanceof Error ? e.message : e)
      return null
    }
  }

  const first = await attempt(t0, 'llm')
  if (first && first.title) return first

  if (maxRetry >= 1) {
    const second = await attempt(t1, 'llm_retry')
    if (second && second.title) return second
    if (second) return { ...second, source: 'fallback_invalid' }
  }

  return {
    title: null,
    originalTitle,
    validation: emptyValidation,
    source: 'fallback_error',
  }
}
