import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

/**
 * POST /api/admin/destination-image-sets/from-pool. 인증: 관리자.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const baseUrl =
      process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
      (request.headers.get('x-forwarded-proto') && request.headers.get('host')
        ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('host')}`
        : null) ||
      (typeof request.url === 'string' ? new URL(request.url).origin : '')

    if (!baseUrl) {
      return NextResponse.json(
        { error: 'NEXTAUTH_URL 또는 요청 origin 필요 (이미지 절대 URL 생성용)' },
        { status: 500 }
      )
    }

    const pool = await prisma.photoPool.findMany({
      orderBy: [{ cityName: 'asc' }, { sortOrder: 'asc' }],
      select: { cityName: true, filePath: true, source: true },
    })

    const byCity = new Map<string, { filePath: string; source: string }[]>()
    for (const row of pool) {
      const path = row.filePath.startsWith('http') ? row.filePath : (baseUrl + (row.filePath.startsWith('/') ? '' : '/') + row.filePath)
      if (!byCity.has(row.cityName)) byCity.set(row.cityName, [])
      byCity.get(row.cityName)!.push({ filePath: path, source: row.source || 'Upload' })
    }

    const updated: string[] = []
    for (const [cityName, items] of Array.from(byCity.entries())) {
      if (items.length < 5) continue
      const main = items[0]
      const schedule = items.slice(1, 5).map((x) => ({
        url: x.filePath,
        source: x.source,
        photographer: x.source,
        originalLink: '',
      }))
      const mainUrl = main.filePath
      const mainSourceJson = JSON.stringify({
        source: main.source,
        photographer: main.source,
        originalLink: '',
      })
      await prisma.destinationImageSet.upsert({
        where: { destinationName: cityName },
        create: {
          destinationName: cityName,
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
      updated.push(cityName)
    }

    return NextResponse.json({
      ok: true,
      message: `풀 사진으로 목적지 이미지 세트 ${updated.length}개 적용`,
      updated,
    })
  } catch (e) {
    console.error('destination-image-sets/from-pool:', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
