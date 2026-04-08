import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import type { ScheduleImageItem } from '@/lib/destination-image-set'

/**
 * GET /api/admin/destination-image-sets. 인증: 관리자.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const list = await prisma.destinationImageSet.findMany({
      orderBy: { destinationName: 'asc' },
    })
    return NextResponse.json(list)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/destination-image-sets. 인증: 관리자.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const body = (await request.json()) as {
      destinationName: string
      mainImageUrl?: string | null
      mainImageSource?: { source?: string; photographer?: string; originalLink?: string } | null
      scheduleImageUrls?: ScheduleImageItem[]
    }
    const name = (body.destinationName ?? '').trim()
    if (!name) {
      return NextResponse.json({ error: 'destinationName 필수' }, { status: 400 })
    }
    const mainUrl = body.mainImageUrl?.trim() || null
    const schedule = Array.isArray(body.scheduleImageUrls)
      ? body.scheduleImageUrls
          .slice(0, 4)
          .map((x) => ({
            url: typeof (x as ScheduleImageItem).url === 'string' ? (x as ScheduleImageItem).url : '',
            source: (x as ScheduleImageItem).source,
            photographer: (x as ScheduleImageItem).photographer,
            originalLink: (x as ScheduleImageItem).originalLink,
          }))
          .filter((x) => x.url.startsWith('http'))
      : []
    if (!mainUrl || !mainUrl.startsWith('http')) {
      return NextResponse.json({ error: 'mainImageUrl(유효한 URL) 필수' }, { status: 400 })
    }
    if (schedule.length < 4) {
      return NextResponse.json({ error: 'scheduleImageUrls 4개(유효한 URL) 필수' }, { status: 400 })
    }

    const mainSourceJson = body.mainImageSource
      ? JSON.stringify({
          source: body.mainImageSource.source ?? 'Pexels',
          photographer: body.mainImageSource.photographer ?? 'Pexels',
          originalLink: body.mainImageSource.originalLink ?? 'https://www.pexels.com',
        })
      : null

    const row = await prisma.destinationImageSet.upsert({
      where: { destinationName: name },
      create: {
        destinationName: name,
        mainImageUrl: mainUrl,
        mainImageSource: mainSourceJson,
        scheduleImageUrls: JSON.stringify(schedule),
      },
      update: {
        mainImageUrl: mainUrl,
        mainImageSource: mainSourceJson,
        scheduleImageUrls: JSON.stringify(schedule),
      },
    })
    return NextResponse.json(row)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
