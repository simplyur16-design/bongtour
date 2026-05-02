/**
 * POST /api/admin/products/regenerate-bg-rehost-labels
 * `bgImageRehostSearchLabel`이 비어 있고 Pexels 사진 ID가 있는 상품에 대해
 * 영문 검색어를 보강한 뒤 `rehostPexelsProductHeroIfNeeded`로 메타(라벨·크기)를 채운다.
 * 대표 이미지 URL(`bgImageUrl`)은 변경하지 않는다(기존 PhotoPool 등 유지).
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { isObjectStorageConfigured } from '@/lib/object-storage'
import { buildPexelsKeyword } from '@/lib/pexels-keyword'
import { rehostPexelsProductHeroIfNeeded } from '@/lib/product-pexels-image-rehost'

function pexelsCdnUrlFromPhotoId(photoId: number): string {
  return `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg`
}

function firstCityKo(destination: string | null, primary: string | null): string | null {
  const raw = (primary ?? destination ?? '').trim()
  if (!raw) return null
  const head = raw.split(/[,，、]/)[0]?.trim()
  return head && head.length > 0 ? head.slice(0, 120) : null
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  if (!isObjectStorageConfigured()) {
    return NextResponse.json({ error: 'Object storage가 설정되지 않았습니다.' }, { status: 503 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    limit?: number
    dryRun?: boolean
  }
  const limit = Math.min(Math.max(Number(body.limit) || 40, 1), 300)
  const dryRun = body.dryRun === true

  const rows = await prisma.product.findMany({
    where: {
      AND: [
        {
          OR: [{ bgImageRehostSearchLabel: null }, { bgImageRehostSearchLabel: '' }],
        },
        { bgImageExternalId: { not: null } },
        { NOT: { bgImageExternalId: '' } },
      ],
    },
    select: {
      id: true,
      title: true,
      destination: true,
      primaryDestination: true,
      primaryRegion: true,
      themeTags: true,
      schedule: true,
      bgImageExternalId: true,
      bgImagePhotographer: true,
      bgImageSourceUrl: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  })

  let ok = 0
  let failed = 0
  const errors: Array<{ id: string; message: string }> = []

  for (const p of rows) {
    const pid = Number(String(p.bgImageExternalId ?? '').trim())
    if (!Number.isInteger(pid) || pid <= 0) {
      failed += 1
      errors.push({ id: p.id, message: 'invalid bgImageExternalId' })
      continue
    }
    const searchKeyword = buildPexelsKeyword({
      destination: p.destination ?? null,
      primaryRegion: p.primaryRegion ?? null,
      themeTags: p.themeTags ?? null,
      title: p.title ?? null,
      scheduleJson: p.schedule ?? null,
    }).trim() || 'travel'
    const cityName = firstCityKo(p.destination, p.primaryDestination)
    const placeName: string | null = null
    const downloadUrl = pexelsCdnUrlFromPhotoId(pid)
    const pexelsPageUrl = (p.bgImageSourceUrl ?? '').trim() || `https://www.pexels.com/photo/${pid}/`

    if (dryRun) {
      ok += 1
      continue
    }


    try {
      const rh = await rehostPexelsProductHeroIfNeeded({
        downloadUrl,
        pexelsPhotoId: pid,
        photographer: (p.bgImagePhotographer ?? '').trim() || null,
        pexelsPageUrl,
        searchKeyword,
        placeName,
        cityName,
      })
      await prisma.product.update({
        where: { id: p.id },
        data: {
          bgImageRehostSearchLabel: rh.searchLabelStored ?? searchKeyword,
          bgImagePlaceName: rh.placeNameStored ?? placeName,
          bgImageCityName: rh.cityNameStored ?? cityName,
          bgImageWidth: rh.width,
          bgImageHeight: rh.height,
          bgImageRehostedAt: new Date(),
        },
      })
      ok += 1
    } catch (e) {
      failed += 1
      const msg = e instanceof Error ? e.message : String(e)
      errors.push({ id: p.id, message: msg })
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    scanned: rows.length,
    updated: ok,
    failed,
    errors: errors.slice(0, 20),
  })
}
