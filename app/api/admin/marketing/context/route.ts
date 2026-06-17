import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json()
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() || null : null
}

/** GET /api/admin/marketing/context?weekKey=YYYY-Www — 주차 운영자 컨텍스트 */
export async function GET(req: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const weekKey = new URL(req.url).searchParams.get('weekKey')?.trim()
  if (!weekKey) {
    return NextResponse.json({ error: 'weekKey 쿼리 필수 (예: 2026-W25)' }, { status: 400 })
  }

  const context = await prisma.bongMarketingContext.findUnique({ where: { weekKey } })
  return NextResponse.json({ context })
}

/** POST /api/admin/marketing/context — 주차 컨텍스트 upsert(weekKey 기준) */
export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'JSON body 필수' }, { status: 400 })

  const weekKey = typeof body.weekKey === 'string' ? body.weekKey.trim() : ''
  if (!weekKey) return NextResponse.json({ error: 'weekKey 필수 (예: 2026-W25)' }, { status: 400 })

  const fields = {
    themeIntent: strOrNull(body.themeIntent),
    targetAudience: strOrNull(body.targetAudience),
    hotInfo: strOrNull(body.hotInfo),
    avoidTone: strOrNull(body.avoidTone),
    customKeywords: strOrNull(body.customKeywords),
  }

  const context = await prisma.bongMarketingContext.upsert({
    where: { weekKey },
    create: { weekKey, ...fields },
    update: fields,
  })

  return NextResponse.json({ context })
}
