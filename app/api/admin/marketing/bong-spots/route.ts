import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { BongContentStatus } from '@prisma/client'
import { parseContentStatus, parsePagination, readJsonBody } from '../shared'

const spotSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  body: true,
  country: true,
  city: true,
  countryKey: true,
  cityKey: true,
  heroImageUrl: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const country = searchParams.get('country')?.trim() || undefined
  const city = searchParams.get('city')?.trim() || undefined
  const statusParam = searchParams.get('status')?.trim()
  const status = parseContentStatus(statusParam) as BongContentStatus | undefined
  const { page, limit, skip } = parsePagination(searchParams)

  const where: {
    country?: string
    city?: string
    status?: BongContentStatus
  } = {}
  if (country) where.country = country
  if (city) where.city = city
  if (status) where.status = status

  try {
    const [items, total] = await Promise.all([
      prisma.bongSpot.findMany({
        where,
        select: spotSelect,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bongSpot.count({ where }),
    ])
    return NextResponse.json({ items, total, page, limit })
  } catch (e) {
    console.error('[admin/marketing/bong-spots GET]', e)
    return NextResponse.json({ error: '목록 조회에 실패했습니다.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const body = await readJsonBody(request)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }
  const b = body as Record<string, unknown>
  const title = typeof b.title === 'string' ? b.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'title은 필수입니다.' }, { status: 400 })
  }

  const slug = typeof b.slug === 'string' && b.slug.trim() ? b.slug.trim() : null
  if (slug) {
    const dup = await prisma.bongSpot.findUnique({ where: { slug }, select: { id: true } })
    if (dup) {
      return NextResponse.json({ error: '이미 사용 중인 slug입니다.' }, { status: 409 })
    }
  }

  const status = parseContentStatus(b.status) ?? 'draft'

  try {
    const row = await prisma.bongSpot.create({
      data: {
        title,
        slug,
        summary: typeof b.summary === 'string' ? b.summary : null,
        body: typeof b.body === 'string' ? b.body : null,
        country: typeof b.country === 'string' ? b.country : null,
        city: typeof b.city === 'string' ? b.city : null,
        countryKey: typeof b.countryKey === 'string' ? b.countryKey : null,
        cityKey: typeof b.cityKey === 'string' ? b.cityKey : null,
        heroImageUrl: typeof b.heroImageUrl === 'string' ? b.heroImageUrl : null,
        status,
      },
      select: spotSelect,
    })
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error('[admin/marketing/bong-spots POST]', e)
    return NextResponse.json({ error: '생성에 실패했습니다.' }, { status: 500 })
  }
}
