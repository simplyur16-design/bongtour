import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MAX_Q = 48
const TAKE_EACH = 10

/**
 * GET /api/public/destination-search?q=
 * 모바일 홈 등 — City / Country 마스터 자동완성(공개 읽기 전용).
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (!raw) {
    return NextResponse.json({ cities: [], countries: [] })
  }
  const q = raw.slice(0, MAX_Q)

  try {
    const [cities, countries] = await Promise.all([
      prisma.city.findMany({
        where: {
          isActive: true,
          OR: [
            { koreanLabel: { contains: q, mode: 'insensitive' } },
            { cityKey: { contains: q, mode: 'insensitive' } },
          ],
          country: { isActive: true },
        },
        take: TAKE_EACH,
        orderBy: [{ isMajor: 'desc' }, { sortOrder: 'asc' }, { koreanLabel: 'asc' }],
        select: {
          cityKey: true,
          koreanLabel: true,
          country: { select: { koreanLabel: true } },
        },
      }),
      prisma.country.findMany({
        where: {
          isActive: true,
          OR: [
            { koreanLabel: { contains: q, mode: 'insensitive' } },
            { countryKey: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: TAKE_EACH,
        orderBy: [{ sortOrder: 'asc' }, { koreanLabel: 'asc' }],
        select: { countryKey: true, koreanLabel: true },
      }),
    ])

    return NextResponse.json({
      cities: cities.map((c) => ({
        cityKey: c.cityKey,
        koreanLabel: c.koreanLabel,
        countryLabel: c.country.koreanLabel,
      })),
      countries: countries.map((c) => ({ countryKey: c.countryKey, koreanLabel: c.koreanLabel })),
    })
  } catch (e) {
    console.error('[destination-search]', e)
    return NextResponse.json({ error: 'search_failed' }, { status: 500 })
  }
}
