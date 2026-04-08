import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { requireAdmin } from '@/lib/require-admin'
import {
  buildGeminiImagePromptForSlot,
  GEMINI_IMAGE_SLOT_ORDER,
  type GeminiImageSlotType,
} from '@/lib/gemini-image-prompt'
import { generateImageWithGemini, IMAGEN_MODEL } from '@/lib/gemini-image-generate'

const UPLOAD_DIR = 'public/uploads/gemini'
const WEB_PREFIX = '/uploads/gemini/'
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
 * 관리자 전용. 4슬롯 고정(무인물 광각·무인물 줌·인물 상반신·인물 전신)으로 각각 Imagen 1장씩 생성.
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

    const dir = path.join(process.cwd(), UPLOAD_DIR)
    await mkdir(dir, { recursive: true })
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
        const filename = `${baseId}-${slot}-${i}.png`
        const filePath = path.join(dir, filename)
        await writeFile(filePath, buffer)
        images.push({ slot, imageUrl: WEB_PREFIX + filename, error: null })
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
    return NextResponse.json(
      { ok: false, error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' } satisfies GeminiImageGenerateResponse,
      { status: 500 }
    )
  }
}
