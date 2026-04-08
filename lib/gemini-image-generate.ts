/**
 * 제미나이(Imagen) 이미지 생성 fallback.
 * Pexels 실패 시 호출. 풀 저장 시 [도시명]_[명소명]_Gemini.webp 형식 사용.
 *
 * 설계:
 * - 우선순위: 풀 → 목적지 세트 → Pexels → (실패 시) 제미나이 생성 → 풀 저장
 * - 생성 시 IMAGEN_REALISTIC_STYLE_PROMPT 적용 (실사·다큐, 건물 지현창조 금지)
 * - 반환: PNG/JPEG Buffer 또는 null (API 미설정/실패 시)
 *
 * Imagen (Gemini API predict): generativelanguage.googleapis.com/v1beta/models/{model}:predict
 * (GEMINI_API_KEY 사용. Imagen 전용 엔드포인트는 모델/키 정책에 따라 상이할 수 있음)
 */

import {
  IMAGEN_ADMIN_TRAVEL_RECORD_SUFFIX,
  IMAGEN_REALISTIC_STYLE_PROMPT,
  IMAGEN_SINGLE_LANDMARK_NEGATIVE_ANCHOR,
  IMAGEN_SINGLE_LANDMARK_STYLE_SUFFIX,
  ITINERARY_DAY_HERO_REGENERATE_PROMPT_EN,
} from '@/lib/image-style'

const API_KEY = process.env.GEMINI_API_KEY ?? ''

/** Gemini API v1beta Imagen 모델 (공식 문서 기준). 구형 imagen-3.0-generate-002 등은 v1beta에서 404 될 수 있음. */
export const IMAGEN_MODEL =
  process.env.IMAGEN_MODEL?.trim() ||
  process.env.GEMINI_IMAGEN_MODEL?.trim() ||
  'imagen-4.0-generate-001'

export type GenerateImageOptions = {
  /** 프롬프트 (장소/키워드). 스타일 문구는 자동 추가 */
  prompt: string
  /** 가로세로비: 4:3 권장 */
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9'
  /**
   * default: 일반 `IMAGEN_REALISTIC_STYLE_PROMPT` (도시 야경 등 포함 → 복수 랜드마크 유도 가능).
   * single_landmark: 일차 대표 1곳 전용 접미사 — 여러 관광지 한 장 합성 억제.
   * admin_travel_slot: 관리자 4슬롯 생성 — 구도·인물은 프롬프트 본문, 여기서는 기록 사진 톤만.
   */
  stylePreset?: 'default' | 'single_landmark' | 'admin_travel_slot'
  /**
   * true: HTTP 오류·빈 응답 시 Error throw (관리자 image-generate 라우트 등).
   * false(기본): null 반환 (process-images 등 폴백 체인).
   */
  strictErrors?: boolean
}

/**
 * 제미나이/Imagen으로 이미지 1장 생성. 실패 시 null.
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
        : IMAGEN_REALISTIC_STYLE_PROMPT
  /** single_landmark: 부정 앵커를 맨 앞에 두고, 끝에 짧은 리마인더로 합성·다중 POI 재유도를 막는다. */
  const fullPrompt =
    stylePreset === 'single_landmark'
      ? `${IMAGEN_SINGLE_LANDMARK_NEGATIVE_ANCHOR}${prompt}. ${styleSuffix} ${ITINERARY_DAY_HERO_REGENERATE_PROMPT_EN}`.trim()
      : `${prompt}. ${styleSuffix}`.trim()

  try {
    // https://ai.google.dev/gemini-api/docs/imagen
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict?key=${API_KEY}`
    const parameters: Record<string, unknown> = { sampleCount: 1 }
    if (aspectRatio) parameters.aspectRatio = aspectRatio
    const body: Record<string, unknown> = {
      instances: [{ prompt: fullPrompt }],
      parameters,
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    const text = await res.text()
    if (!res.ok) {
      let detail = text.slice(0, 1200)
      try {
        const j = JSON.parse(text) as { error?: { message?: string; status?: string } }
        if (j?.error?.message) detail = j.error.message
      } catch {
        /* raw text */
      }
      const msg = `Imagen model "${IMAGEN_MODEL}" API error ${res.status}: ${detail}`
      return failOrNull(strict, msg)
    }
    const data = JSON.parse(text) as { predictions?: Array<{ bytesBase64Encoded?: string }> }
    const b64 = data?.predictions?.[0]?.bytesBase64Encoded
    if (!b64) {
      return failOrNull(
        strict,
        `Imagen model "${IMAGEN_MODEL}": empty predictions (no image bytes). Response: ${text.slice(0, 400)}`
      )
    }
    return Buffer.from(b64, 'base64')
  } catch (e) {
    const base = e instanceof Error ? e.message : String(e)
    if (strict) throw e instanceof Error ? e : new Error(base)
    console.warn('[gemini-image] 생성 예외:', base)
    return null
  }
}
