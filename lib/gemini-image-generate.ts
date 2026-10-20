/**
 * 제미나이 이미지 생성 fallback.
 * Pexels 실패 시 호출. 풀 저장 시 [도시명]_[명소명]_Gemini.webp 형식 사용.
 *
 * 설계:
 * - 우선순위: 풀 → 목적지 세트 → Pexels → (실패 시) 제미나이 생성 → 풀 저장
 * - 생성 시 IMAGEN_REALISTIC_STYLE_PROMPT 적용 (실사·다큐, 건물 지현창조 금지)
 * - 반환: PNG/JPEG Buffer 또는 null (API 미설정/실패 시)
 *
 * 경로:
 * 1) `imagen-*` → `:predict` (Imagen)
 * 2) 그 외 / Imagen 404 → `:generateContent` (gemini-*-image, responseModalities IMAGE)
 */

import {
  IMAGEN_ADMIN_TRAVEL_RECORD_SUFFIX,
  IMAGEN_FLAT_ITINERARY_MAP_STYLE_SUFFIX,
  IMAGEN_REALISTIC_STYLE_PROMPT,
  IMAGEN_SINGLE_LANDMARK_NEGATIVE_ANCHOR,
  IMAGEN_SINGLE_LANDMARK_STYLE_SUFFIX,
  ITINERARY_DAY_HERO_REGENERATE_PROMPT_EN,
} from '@/lib/image-style'

const API_KEY = process.env.GEMINI_API_KEY ?? ''

/**
 * 이미지 생성 모델 (Gemini native image만 사용).
 * 일정 동선 지도·일반 슬롯 모두 generateContent. Imagen `:predict` 는 쓰지 않음.
 */
export const IMAGEN_MODEL =
  process.env.GEMINI_IMAGE_MODEL?.trim() ||
  process.env.IMAGEN_MODEL?.trim() ||
  process.env.GEMINI_IMAGEN_MODEL?.trim() ||
  'gemini-3-pro-image'

const GEMINI_IMAGE_FALLBACK_MODEL = 'gemini-2.5-flash-image'

export type GenerateImageOptions = {
  /** 프롬프트 (장소/키워드). 스타일 문구는 자동 추가 */
  prompt: string
  /** 가로세로비: 4:3 권장 */
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9'
  /**
   * default: 일반 `IMAGEN_REALISTIC_STYLE_PROMPT` (도시 야경 등 포함 → 복수 랜드마크 유도 가능).
   * single_landmark: 일차 대표 1곳 전용 접미사 — 여러 관광지 한 장 합성 억제.
   * admin_travel_slot: 관리자 4슬롯 생성 — 구도·인물은 프롬프트 본문, 여기서는 기록 사진 톤만.
   * flat_itinerary_map: 일정 동선 플랫 2D 인포그래픽 — 실사 접미사 금지.
   */
  stylePreset?: 'default' | 'single_landmark' | 'admin_travel_slot' | 'flat_itinerary_map'
  /**
   * true: HTTP 오류·빈 응답 시 Error throw (관리자 image-generate 라우트 등).
   * false(기본): null 반환 (process-images 등 폴백 체인).
   */
  strictErrors?: boolean
}

/**
 * Gemini native image로 이미지 1장 생성. 실패 시 null.
 * 반환 Buffer는 PNG 또는 JPEG (API 응답에 따름).
 */
function failOrNull(strict: boolean | undefined, message: string): null {
  if (strict) throw new Error(message)
  console.warn('[gemini-image]', message)
  return null
}

export async function generateImageWithGemini(options: GenerateImageOptions): Promise<Buffer | null> {
  const { prompt, strictErrors: strict, aspectRatio, stylePreset = 'default' } = options
  if (!API_KEY) {
    return failOrNull(strict, 'GEMINI_API_KEY가 설정되지 않았습니다.')
  }

  const styleSuffix =
    stylePreset === 'single_landmark'
      ? IMAGEN_SINGLE_LANDMARK_STYLE_SUFFIX
      : stylePreset === 'admin_travel_slot'
        ? IMAGEN_ADMIN_TRAVEL_RECORD_SUFFIX
        : stylePreset === 'flat_itinerary_map'
          ? IMAGEN_FLAT_ITINERARY_MAP_STYLE_SUFFIX
          : IMAGEN_REALISTIC_STYLE_PROMPT
  /** single_landmark: 부정 앵커를 맨 앞에 두고, 끝에 짧은 리마인더로 합성·다중 POI 재유도를 막는다. */
  const fullPrompt =
    stylePreset === 'single_landmark'
      ? `${IMAGEN_SINGLE_LANDMARK_NEGATIVE_ANCHOR}${prompt}. ${styleSuffix} ${ITINERARY_DAY_HERO_REGENERATE_PROMPT_EN}`.trim()
      : `${prompt}. ${styleSuffix}`.trim()

  // 일정 동선 지도·기본 슬롯 모두 Gemini generateContent 만 사용 (Imagen predict 금지).
  const primaryModel = /^imagen-/i.test(IMAGEN_MODEL) ? GEMINI_IMAGE_FALLBACK_MODEL : IMAGEN_MODEL

  try {
    const native = await generateViaGeminiNativeImage(primaryModel, fullPrompt, aspectRatio)
    if (native.ok) return native.buffer
    if (primaryModel !== GEMINI_IMAGE_FALLBACK_MODEL) {
      console.warn(
        `[gemini-image] "${primaryModel}" failed (${native.error.slice(0, 160)}); retry ${GEMINI_IMAGE_FALLBACK_MODEL}`,
      )
      const fallback = await generateViaGeminiNativeImage(
        GEMINI_IMAGE_FALLBACK_MODEL,
        fullPrompt,
        aspectRatio,
      )
      if (fallback.ok) return fallback.buffer
      return failOrNull(strict, fallback.error)
    }
    return failOrNull(strict, native.error)
  } catch (e) {
    const base = e instanceof Error ? e.message : String(e)
    if (strict) throw e instanceof Error ? e : new Error(base)
    console.warn('[gemini-image] 생성 예외:', base)
    return null
  }
}

type GenResult = { ok: true; buffer: Buffer } | { ok: false; error: string; status?: number }

async function generateViaGeminiNativeImage(
  model: string,
  fullPrompt: string,
  aspectRatio?: GenerateImageOptions['aspectRatio'],
): Promise<GenResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`
  const generationConfig: Record<string, unknown> = {
    responseModalities: ['TEXT', 'IMAGE'],
  }
  if (aspectRatio) {
    generationConfig.imageConfig = { aspectRatio }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig,
    }),
    signal: AbortSignal.timeout(90000),
  })
  const text = await res.text()
  if (!res.ok) {
    let detail = text.slice(0, 1200)
    try {
      const j = JSON.parse(text) as { error?: { message?: string } }
      if (j?.error?.message) detail = j.error.message
    } catch {
      /* raw */
    }
    return {
      ok: false,
      status: res.status,
      error: `Gemini image model "${model}" API error ${res.status}: ${detail}`,
    }
  }
  const data = JSON.parse(text) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }> }
    }>
  }
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const inline = parts.find((p) => p.inlineData?.data)?.inlineData
  if (!inline?.data) {
    return {
      ok: false,
      error: `Gemini image model "${model}": no inline image in response. ${text.slice(0, 400)}`,
    }
  }
  return { ok: true, buffer: Buffer.from(inline.data, 'base64') }
}
