import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import {
  buildGeminiImagePromptForSlot,
  buildTrainingGeminiImagePromptForSlot,
  GEMINI_IMAGE_SLOT_ORDER,
  TRAINING_GEMINI_IMAGE_SLOT_ORDER,
  type GeminiImageSlotType,
  type TrainingGeminiImageSlotType,
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
  slot: GeminiImageSlotType | TrainingGeminiImageSlotType
  error?: string | null
}

export type GeminiImageGenerateResponse =
  | {
      ok: true
      /** 하위 호환: 슬롯 프롬프트를 줄바꿈으로 이은 요약 */
      promptUsed: string
      promptsBySlot: { slot: GeminiImageSlotType | TrainingGeminiImageSlotType; text: string }[]
      images: GeminiImageCandidate[]
    }
  | { ok: false; error: string }

/**
 * POST /api/admin/gemini/image-generate
 * 관리자 전용. 슬롯별 Imagen 1장씩 생성(기본 4슬롯).
 *
 * REGRESSION-FREEZE[admin-gemini-image-generate-parallel]: slots run in parallel — manifest
 * (이전 순차 await는 일차당 1~2분 체감. Promise.all로 벽시계 ≈ 최장 슬롯 1회.)
 *
 * body.maxSlots (1~4, 선택): 앞쪽 슬롯만 생성. 일차 이미지 수급은 보통 2로 호출.
 * Storage에 WebP 업로드 후 공개 HTTPS URL만 반환.
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
    const profile = typeof body.profile === 'string' ? body.profile.trim() : 'travel'
    const trainingDescription =
      typeof body.trainingDescription === 'string' ? body.trainingDescription.trim() : null
    const trainingCategory =
      typeof body.trainingCategory === 'string' ? body.trainingCategory.trim() : null
    const maxSlotsRaw = typeof body.maxSlots === 'number' ? body.maxSlots : Number(body.maxSlots)
    const maxSlots =
      Number.isFinite(maxSlotsRaw) && maxSlotsRaw >= 1
        ? Math.min(4, Math.floor(maxSlotsRaw))
        : null

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

    const isTraining = profile === 'overseas_training'
    const now = new Date()
    const baseId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const fullSlotList: Array<GeminiImageSlotType | TrainingGeminiImageSlotType> = isTraining
      ? [...TRAINING_GEMINI_IMAGE_SLOT_ORDER]
      : [...GEMINI_IMAGE_SLOT_ORDER]
    const slotList =
      maxSlots != null ? fullSlotList.slice(0, Math.min(maxSlots, fullSlotList.length)) : fullSlotList

    const promptsBySlot = slotList.map((slot) => {
      const text = isTraining
        ? buildTrainingGeminiImagePromptForSlot(
            {
              title,
              destination: destination || primaryRegion,
              trainingCategory,
              trainingDescription,
            },
            promptOverride,
            slot as TrainingGeminiImageSlotType
          )
        : buildGeminiImagePromptForSlot(promptOptions, promptOverride, slot as GeminiImageSlotType)
      return { slot, text }
    })

    // REGRESSION-FREEZE[admin-gemini-image-generate-parallel]: Promise.all slot generate — manifest
    const images = await Promise.all(
      promptsBySlot.map(async ({ slot, text: slotPrompt }, i) => {
        try {
          const buffer = await generateImageWithGemini({
            prompt: slotPrompt,
            aspectRatio: '16:9',
            strictErrors: true,
            stylePreset: 'admin_travel_slot',
          })
          if (!buffer || buffer.length === 0) {
            return { slot, imageUrl: null, error: 'empty_buffer' } satisfies GeminiImageCandidate
          }

          const webp = await convertToWebp(buffer, { maxWidth: 2400, quality: 82 })
          const objectKey = buildGeminiGeneratedObjectKey(now, baseId, slot, i)
          const { publicUrl } = await uploadStorageObject({
            objectKey,
            body: webp.buffer,
            contentType: 'image/webp',
          })
          return { slot, imageUrl: publicUrl, error: null } satisfies GeminiImageCandidate
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { slot, imageUrl: null, error: msg.slice(0, 400) } satisfies GeminiImageCandidate
        }
      })
    )

    const promptUsed = promptsBySlot.map((p) => `[${p.slot}] ${p.text}`).join('\n\n')

    if (!images.some((x) => x.imageUrl)) {
      return NextResponse.json(
        {
          ok: false,
          error: `${slotList.length}슬롯 모두 실패했습니다. Imagen 모델: ${IMAGEN_MODEL}. 키·쿼터·프롬프트를 확인하세요.`,
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
