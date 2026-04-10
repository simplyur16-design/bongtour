import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import {
  buildGeminiImagePromptForSlot,
  GEMINI_IMAGE_SLOT_ORDER,
  type GeminiImageSlotType,
} from '@/lib/gemini-image-prompt'
import { generateImageWithGemini, IMAGEN_MODEL } from '@/lib/gemini-image-generate'
import { convertToWebp } from '@/lib/image-to-webp'
import {
  buildGeminiGeneratedObjectKey,
  isObjectStorageConfigured,
  uploadStorageObject,
} from '@/lib/object-storage'

const PROMPT_OVERRIDE_MAX = 500

export type GeminiImageCandidate = {
  imageUrl: string | null
  slot: GeminiImageSlotType
  error?: string | null
}

export type GeminiImageGenerateResponse =
  | {
      ok: true
      /** 하위 호환: 슬롯 프롬프트를 줄바꿈으로 이은 요약 */
      promptUsed: string
      promptsBySlot: { slot: GeminiImageSlotType; text: string }[]
      images: GeminiImageCandidate[]
    }
  | { ok: false; error: string }

/**
 * POST /api/admin/gemini/image-generate
 * 관리자 전용. 4슬롯 고정으로 각각 Imagen 1장씩 생성.
 *
 * Supabase Storage에 WebP로 업로드한 뒤 공개 HTTPS URL만 반환 (로컬 디스크 미사용).
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: '인증이 필요합니다.' } satisfies GeminiImageGenerateResponse,
      { status: 401 }
    )
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'GEMINI_API_KEY가 설정되지 않았습니다.' } satisfies GeminiImageGenerateResponse,
      { status: 503 }
    )
  }

  const storageOk = isObjectStorageConfigured()
  if (process.env.NODE_ENV === 'production' && !storageOk) {
    return NextResponse.json(
      {
        ok: false,
        error:
          '운영 환경에서는 Supabase Storage 설정이 필요합니다. SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, 선택 SUPABASE_IMAGE_BUCKET(기본 bongtour-images).',
      } satisfies GeminiImageGenerateResponse,
      { status: 503 }
    )
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const rawOverride = typeof body.promptOverride === 'string' ? body.promptOverride.trim() : ''
    const promptOverride = rawOverride.length > 0 ? rawOverride.slice(0, PROMPT_OVERRIDE_MAX) : null
    const title = typeof body.title === 'string' ? body.title.trim() : null
    const destination = typeof body.destination === 'string' ? body.destination.trim() : null
    const primaryRegion = typeof body.primaryRegion === 'string' ? body.primaryRegion.trim() : null
    const themeTags = typeof body.themeTags === 'string' ? body.themeTags.trim() : null
    const displayCategory = typeof body.displayCategory === 'string' ? body.displayCategory.trim() : null
    const attractionName =
      typeof body.attractionName === 'string' ? body.attractionName.trim() : null
    const poiNamesRaw = typeof body.poiNamesRaw === 'string' ? body.poiNamesRaw.trim() : null
    const scheduleJson = typeof body.scheduleJson === 'string' ? body.scheduleJson.trim() : null

    const promptOptions = {
      destination,
      primaryRegion,
      themeTags,
      title,
      displayCategory,
      attractionName: attractionName || null,
      poiNamesRaw: poiNamesRaw || null,
      scheduleJson: scheduleJson || null,
    }

    const promptsBySlot: { slot: GeminiImageSlotType; text: string }[] = []
    const images: GeminiImageCandidate[] = []

    const now = new Date()
    const baseId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    for (let i = 0; i < GEMINI_IMAGE_SLOT_ORDER.length; i++) {
      const slot = GEMINI_IMAGE_SLOT_ORDER[i]!
      const slotPrompt = buildGeminiImagePromptForSlot(promptOptions, promptOverride, slot)
      promptsBySlot.push({ slot, text: slotPrompt })

      try {
        const buffer = await generateImageWithGemini({
          prompt: slotPrompt,
          aspectRatio: '16:9',
          strictErrors: true,
          stylePreset: 'admin_travel_slot',
        })
        if (!buffer || buffer.length === 0) {
          images.push({ slot, imageUrl: null, error: 'empty_buffer' })
          continue
        }

        const webp = await convertToWebp(buffer, { maxWidth: 2400, quality: 82 })
        const objectKey = buildGeminiGeneratedObjectKey(now, baseId, slot, i)
        const { publicUrl } = await uploadStorageObject({
          objectKey,
          body: webp.buffer,
          contentType: 'image/webp',
        })
        images.push({ slot, imageUrl: publicUrl, error: null })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        images.push({ slot, imageUrl: null, error: msg.slice(0, 400) })
      }
    }

    const promptUsed = promptsBySlot.map((p) => `[${p.slot}] ${p.text}`).join('\n\n')

    if (!images.some((x) => x.imageUrl)) {
      return NextResponse.json(
        {
          ok: false,
          error: `4슬롯 모두 실패했습니다. Imagen 모델: ${IMAGEN_MODEL}. 키·쿼터·프롬프트를 확인하세요.`,
        } satisfies GeminiImageGenerateResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      promptUsed,
      promptsBySlot,
      images,
    } satisfies GeminiImageGenerateResponse)
  } catch (e) {
    console.error('[gemini/image-generate]', e)
    const dev = process.env.NODE_ENV === 'development'
    const detail = e instanceof Error ? e.message : String(e)
    const msg = dev
      ? `처리 중 오류: ${detail.slice(0, 500)}`
      : '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    return NextResponse.json(
      { ok: false, error: msg } satisfies GeminiImageGenerateResponse,
      { status: 500 }
    )
  }
}
