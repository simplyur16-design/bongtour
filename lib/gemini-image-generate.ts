/**
 * Gemini 네이티브 이미지 생성 (Nano Banana / flash-image).
 * Imagen `:predict` 는 셧다운 — generateContent + IMAGE modality 사용.
 */

import {
  IMAGEN_ADMIN_TRAVEL_RECORD_SUFFIX,
  IMAGEN_REALISTIC_STYLE_PROMPT,
  IMAGEN_ROUTE_MAP_STYLE_SUFFIX,
  IMAGEN_SINGLE_LANDMARK_NEGATIVE_ANCHOR,
  IMAGEN_SINGLE_LANDMARK_STYLE_SUFFIX,
  ITINERARY_DAY_HERO_REGENERATE_PROMPT_EN,
} from '@/lib/image-style'

const API_KEY = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()

/** @deprecated Imagen 셧다운 — 호환 export만 유지. 실제 호출은 GEMINI_IMAGE_MODEL */
export const IMAGEN_MODEL =
  process.env.IMAGEN_MODEL?.trim() ||
  process.env.GEMINI_IMAGEN_MODEL?.trim() ||
  'imagen-4.0-generate-001'

/** 동선지도·폴백 이미지 — 계정에 있는 flash-image 계열 */
export const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL?.trim() ||
  process.env.GEMINI_FLASH_IMAGE_MODEL?.trim() ||
  'gemini-2.5-flash-image'

const GEMINI_IMAGE_MODEL_FALLBACKS = [
  GEMINI_IMAGE_MODEL,
  'gemini-nano-banana-2.1',
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-lite-image',
]

export type GeminiReferenceImage = { mimeType: string; data: string }

export type GenerateImageOptions = {
  prompt: string
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9'
  stylePreset?: 'default' | 'single_landmark' | 'admin_travel_slot' | 'route_map'
  /** 스타일 레퍼런스(동선지도 터키 베이스라인 등) */
  referenceImages?: GeminiReferenceImage[]
  strictErrors?: boolean
}

function failOrNull(strict: boolean | undefined, message: string): null {
  if (strict) throw new Error(message)
  console.warn('[gemini-image]', message)
  return null
}

function buildFullPrompt(
  prompt: string,
  stylePreset: NonNullable<GenerateImageOptions['stylePreset']>
): string {
  const styleSuffix =
    stylePreset === 'single_landmark'
      ? IMAGEN_SINGLE_LANDMARK_STYLE_SUFFIX
      : stylePreset === 'admin_travel_slot'
        ? IMAGEN_ADMIN_TRAVEL_RECORD_SUFFIX
        : stylePreset === 'route_map'
          ? IMAGEN_ROUTE_MAP_STYLE_SUFFIX
          : IMAGEN_REALISTIC_STYLE_PROMPT
  if (stylePreset === 'single_landmark') {
    return `${IMAGEN_SINGLE_LANDMARK_NEGATIVE_ANCHOR}${prompt}. ${styleSuffix} ${ITINERARY_DAY_HERO_REGENERATE_PROMPT_EN}`.trim()
  }
  return `${prompt}. ${styleSuffix}`.trim()
}

function extractImageBufferFromGenerateContent(data: unknown): Buffer | null {
  const root = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> }
    }>
  }
  const parts = root?.candidates?.[0]?.content?.parts ?? []
  for (const p of parts) {
    const b64 = p?.inlineData?.data
    if (b64 && b64.length > 64) return Buffer.from(b64, 'base64')
  }
  return null
}

async function generateViaFlashImage(
  fullPrompt: string,
  aspectRatio: GenerateImageOptions['aspectRatio'] | undefined,
  model: string,
  referenceImages?: GeminiReferenceImage[]
): Promise<{ buf: Buffer | null; error?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`
  const generationConfig: Record<string, unknown> = {
    responseModalities: ['TEXT', 'IMAGE'],
  }
  if (aspectRatio) {
    generationConfig.imageConfig = { aspectRatio }
  }
  const parts: Array<Record<string, unknown>> = []
  for (const img of referenceImages ?? []) {
    if (!img?.data || !img.mimeType) continue
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } })
  }
  parts.push({ text: fullPrompt })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig,
    }),
    signal: AbortSignal.timeout(90_000),
  })
  const text = await res.text()
  if (!res.ok) {
    let detail = text.slice(0, 800)
    try {
      const j = JSON.parse(text) as { error?: { message?: string } }
      if (j?.error?.message) detail = j.error.message
    } catch {
      /* raw */
    }
    return { buf: null, error: `${model} ${res.status}: ${detail}` }
  }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { buf: null, error: `${model}: bad json` }
  }
  const buf = extractImageBufferFromGenerateContent(data)
  if (!buf) return { buf: null, error: `${model}: no image parts` }
  return { buf }
}

/**
 * Gemini flash-image로 이미지 1장 생성. 실패 시 null.
 */
export async function generateImageWithGemini(options: GenerateImageOptions): Promise<Buffer | null> {
  const {
    prompt,
    strictErrors: strict,
    aspectRatio,
    stylePreset = 'default',
    referenceImages,
  } = options
  if (!API_KEY) {
    return failOrNull(strict, 'GEMINI_API_KEY가 설정되지 않았습니다.')
  }

  const fullPrompt = buildFullPrompt(prompt, stylePreset)
  const tried: string[] = []
  const models = [...new Set(GEMINI_IMAGE_MODEL_FALLBACKS.filter(Boolean))]

  try {
    for (const model of models) {
      const { buf, error } = await generateViaFlashImage(
        fullPrompt,
        aspectRatio,
        model,
        referenceImages
      )
      if (buf) return buf
      if (error) {
        tried.push(error)
        console.warn('[gemini-image]', error.slice(0, 240))
      }
    }
    return failOrNull(strict, `Gemini image 실패: ${tried.join(' | ').slice(0, 600)}`)
  } catch (e) {
    const base = e instanceof Error ? e.message : String(e)
    if (strict) throw e instanceof Error ? e : new Error(base)
    console.warn('[gemini-image] 생성 예외:', base)
    return null
  }
}
