import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import {
  buildTrainingGeminiImagePromptForSlot,
  TRAINING_GEMINI_IMAGE_SLOT_ORDER,
  type TrainingGeminiImageSlotType,
} from '@/lib/gemini-image-prompt'

const PROMPT_OVERRIDE_MAX = 500

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const rawOverride = typeof body.promptOverride === 'string' ? body.promptOverride.trim() : ''
  const promptOverride = rawOverride.length > 0 ? rawOverride.slice(0, PROMPT_OVERRIDE_MAX) : null
  const title = typeof body.title === 'string' ? body.title.trim() : null
  const destination = typeof body.destination === 'string' ? body.destination.trim() : null
  const trainingCategory =
    typeof body.trainingCategory === 'string' ? body.trainingCategory.trim() : null
  const trainingDescription =
    typeof body.trainingDescription === 'string' ? body.trainingDescription.trim() : null

  const promptsBySlot = TRAINING_GEMINI_IMAGE_SLOT_ORDER.map((slot) => ({
    slot,
    text: buildTrainingGeminiImagePromptForSlot(
      {
        title,
        destination,
        trainingCategory,
        trainingDescription: trainingDescription?.slice(0, 2000) ?? null,
      },
      promptOverride,
      slot as TrainingGeminiImageSlotType
    ),
  }))

  return NextResponse.json({ ok: true, promptsBySlot })
}
