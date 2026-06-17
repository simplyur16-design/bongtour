import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json()
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function parseIntField(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) return fallback
  return v
}

/** GET /api/admin/marketing/hook-learn-config */
export async function GET() {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const config = await prisma.bongHookLearnConfig.findUnique({
    where: { configKey: 'default' },
  })

  return NextResponse.json({ config })
}

/** POST /api/admin/marketing/hook-learn-config */
export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'JSON body 필수' }, { status: 400 })

  const topPercentile = parseIntField(body.topPercentile, 20)
  const bottomPercentile = parseIntField(body.bottomPercentile, 20)
  const minSampleSize = parseIntField(body.minSampleSize, 20)
  const lookbackDays = parseIntField(body.lookbackDays, 90)
  const enabled = body.enabled !== false

  if (topPercentile < 1 || topPercentile > 50) {
    return NextResponse.json({ error: 'topPercentile은 1-50 사이' }, { status: 400 })
  }
  if (bottomPercentile < 1 || bottomPercentile > 50) {
    return NextResponse.json({ error: 'bottomPercentile은 1-50 사이' }, { status: 400 })
  }
  if (minSampleSize < 5) {
    return NextResponse.json({ error: 'minSampleSize는 5 이상' }, { status: 400 })
  }
  if (lookbackDays < 7) {
    return NextResponse.json({ error: 'lookbackDays는 7 이상' }, { status: 400 })
  }

  const config = await prisma.bongHookLearnConfig.upsert({
    where: { configKey: 'default' },
    update: { topPercentile, bottomPercentile, minSampleSize, lookbackDays, enabled },
    create: {
      configKey: 'default',
      topPercentile,
      bottomPercentile,
      minSampleSize,
      lookbackDays,
      enabled,
    },
  })

  return NextResponse.json({ config })
}
