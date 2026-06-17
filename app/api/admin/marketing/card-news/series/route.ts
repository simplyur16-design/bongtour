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

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
}

const SEASONS = ['spring', 'summer', 'autumn', 'winter', 'all_year'] as const

function parsePositiveInt(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) return null
  return v
}

/** GET /api/admin/marketing/card-news/series — 최근 시리즈 50개 + 편 요약 */
export async function GET() {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const series = await prisma.bongCardNewsSeries.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      episodes: {
        orderBy: { episodeNumber: 'asc' },
        select: { id: true, episodeNumber: true, title: true, formatType: true, status: true },
      },
    },
  })

  return NextResponse.json({ series })
}

/** POST /api/admin/marketing/card-news/series — 시리즈 생성 */
export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const body = await readJson(req)
  if (!body) {
    return NextResponse.json({ error: 'JSON body 필수' }, { status: 400 })
  }

  const weekKey = typeof body.weekKey === 'string' ? body.weekKey.trim() : ''
  const themeTitle = typeof body.themeTitle === 'string' ? body.themeTitle.trim() : ''
  const selectedCities = asStringArray(body.selectedCities)
  const tripNights = parsePositiveInt(body.tripNights)
  const tripDays = parsePositiveInt(body.tripDays)

  if (!weekKey) return NextResponse.json({ error: 'weekKey 필수 (예: 2026-W25)' }, { status: 400 })
  if (!themeTitle) return NextResponse.json({ error: 'themeTitle 필수' }, { status: 400 })
  if (tripNights === null || tripDays === null) {
    return NextResponse.json({ error: 'tripNights, tripDays 정수 필수' }, { status: 400 })
  }
  if (tripNights < 1 || tripDays < 2) {
    return NextResponse.json({ error: 'tripNights≥1, tripDays≥2 필요' }, { status: 400 })
  }

  let season: string | null = null
  if (typeof body.season === 'string' && body.season.trim()) {
    const s = body.season.trim()
    if (!(SEASONS as readonly string[]).includes(s)) {
      return NextResponse.json({ error: 'season 은 spring|summer|autumn|winter|all_year' }, { status: 400 })
    }
    season = s === 'all_year' ? s : s
  }

  const series = await prisma.bongCardNewsSeries.create({
    data: {
      weekKey,
      themeTitle,
      selectedCities,
      tripNights,
      tripDays,
      season,
      operatorNote: typeof body.operatorNote === 'string' ? body.operatorNote.trim() || null : null,
    },
  })

  return NextResponse.json({ series }, { status: 201 })
}
