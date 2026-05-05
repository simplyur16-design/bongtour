import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { BongContentStatus } from '@prisma/client'
import { parseContentStatus, parsePagination, readJsonBody } from '../shared'

const foodSelect = {
  id: true,
  name: true,
  description: true,
  category: true,
  country: true,
  city: true,
  countryKey: true,
  cityKey: true,
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
  const status = parseContentStatus(searchParams.get('status')) as BongContentStatus | undefined
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
      prisma.bongFood.findMany({
        where,
        select: foodSelect,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bongFood.count({ where }),
    ])
    return NextResponse.json({ items, total, page, limit })
  } catch (e) {
    console.error('[bong-foods GET]', e)
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
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'name은 필수입니다.' }, { status: 400 })
  }
  const status = parseContentStatus(b.status) ?? 'draft'

  try {
    const row = await prisma.bongFood.create({
      data: {
        name,
        description: typeof b.description === 'string' ? b.description : null,
        category: typeof b.category === 'string' ? b.category : null,
        country: typeof b.country === 'string' ? b.country : null,
        city: typeof b.city === 'string' ? b.city : null,
        countryKey: typeof b.countryKey === 'string' ? b.countryKey : null,
        cityKey: typeof b.cityKey === 'string' ? b.cityKey : null,
        status,
      },
      select: foodSelect,
    })
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error('[bong-foods POST]', e)
    return NextResponse.json({ error: '생성에 실패했습니다.' }, { status: 500 })
  }
}
