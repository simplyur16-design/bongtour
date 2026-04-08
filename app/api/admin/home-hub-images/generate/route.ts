import { NextResponse } from 'next/server'
import { copyFile, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { requireAdmin } from '@/lib/require-admin'
import { generateImageWithGemini } from '@/lib/gemini-image-generate'
import { appendHomeHubCandidates, isValidCardKey, isValidSeason } from '@/lib/home-hub-candidates'
import type { HomeHubCandidateRecord } from '@/lib/home-hub-candidates-types'

const CANDIDATES_DIR = path.join(process.cwd(), 'public', 'images', 'home-hub', 'candidates')
const PROMPT_MAX = 4000
const VALID_COUNTS = new Set([2, 4, 6])

function publicUrlForFilename(filename: string): string {
  return `/images/home-hub/candidates/${filename}`
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    cardKey?: string
    season?: string
    promptText?: string
    count?: number
  }

  const cardKey = typeof body.cardKey === 'string' ? body.cardKey.trim() : ''
  const season = typeof body.season === 'string' ? body.season.trim() : ''
  const promptText =
    typeof body.promptText === 'string' ? body.promptText.trim().slice(0, PROMPT_MAX) : ''
  const count = typeof body.count === 'number' ? body.count : NaN

  if (!isValidCardKey(cardKey)) {
    return NextResponse.json({ ok: false, error: '유효한 cardKey가 필요합니다.' }, { status: 400 })
  }
  if (!isValidSeason(season)) {
    return NextResponse.json({ ok: false, error: '유효한 season이 필요합니다.' }, { status: 400 })
  }
  if (!promptText) {
    return NextResponse.json({ ok: false, error: 'promptText가 필요합니다.' }, { status: 400 })
  }
  if (!VALID_COUNTS.has(count)) {
    return NextResponse.json({ ok: false, error: 'count는 2, 4, 6 중 하나여야 합니다.' }, { status: 400 })
  }

  const createdBy =
    (admin.user as { email?: string | null }).email?.trim() || admin.user.id || 'admin'

  await mkdir(CANDIDATES_DIR, { recursive: true })

  const baseStub = path.join(process.cwd(), 'public', 'images', 'home-hub', 'base', `${cardKey}.jpg`)
  const newItems: HomeHubCandidateRecord[] = []
  const batch = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  for (let i = 0; i < count; i++) {
    const id = `${cardKey}-${season}-${batch}-${i}`
    let generationProvider: HomeHubCandidateRecord['generationProvider'] = 'gemini'
    let filename = `${id}.png`

    const buffer = await generateImageWithGemini({
      prompt: promptText,
      aspectRatio: '16:9',
      strictErrors: false,
    })

    if (buffer && buffer.length > 0) {
      await writeFile(path.join(CANDIDATES_DIR, filename), buffer)
    } else {
      generationProvider = 'stub'
      filename = `${id}.jpg`
      try {
        await copyFile(baseStub, path.join(CANDIDATES_DIR, filename))
      } catch (e) {
        console.error('[home-hub-images/generate] stub copy failed', e)
        return NextResponse.json(
          {
            ok: false,
            error:
              '이미지 생성에 실패했고 기본 스텁 복사도 실패했습니다. GEMINI_API_KEY와 base 이미지를 확인하세요.',
          },
          { status: 500 }
        )
      }
    }

    const now = new Date().toISOString()
    newItems.push({
      id,
      cardKey,
      season,
      promptText,
      promptVersion: 'v1',
      imagePath: publicUrlForFilename(filename),
      generationProvider,
      isSelected: false,
      isActive: false,
      createdAt: now,
      updatedAt: now,
      createdBy,
      note: generationProvider === 'stub' ? 'gemini-fallback-stub' : '',
    })
  }

  appendHomeHubCandidates(newItems)

  return NextResponse.json({ ok: true, items: newItems })
}
