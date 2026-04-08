import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { recordAssetUsage, normalizeSelectionMode } from '@/lib/asset-usage-log'
import { findImageAssetByPublicUrl } from '@/lib/image-assets-db'

type RouteParams = { params: Promise<{ id: string }> }

type ScheduleEntry = {
  day?: number
  title?: string
  description?: string
  imageKeyword?: string
  imageUrl?: string | null
  imageSource?: { source?: string; photographer?: string; originalLink?: string; externalId?: string | null }
  imageManualSelected?: boolean
  imageSelectionMode?: string | null
  imageCandidateOrigin?: string | null
  /** image_assets SEO / 관리자 명시 — 공개 캡션 우선(getScheduleFromProduct) */
  imageSeoTitleKr?: string | null
  imageAttractionName?: string | null
  imageDisplayNameManual?: string | null
}

/**
 * POST /api/admin/products/[id]/schedule-images
 * 일정 day 이미지 수동 선택 저장(자동 후보보다 우선).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { id } = await params
    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    const body = (await request.json().catch(() => ({}))) as {
      day?: number
      imageUrl?: string
      imageKeyword?: string | null
      source?: string
      photographer?: string | null
      originalLink?: string | null
      externalId?: string | null
      manualSelected?: boolean
      selectionMode?: string | null
      imageSeoTitleKr?: string | null
      imageAttractionName?: string | null
      imageDisplayNameManual?: string | null
    }
    const day = Number(body.day)
    if (!Number.isInteger(day) || day < 1) {
      return NextResponse.json({ error: '유효한 day가 필요합니다.' }, { status: 400 })
    }
    const imageUrl = String(body.imageUrl ?? '').trim().slice(0, 2000)
    const product = await prisma.product.findUnique({ where: { id }, select: { id: true, schedule: true } })
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    /** 일정별 Pexels/Gemini 검색어 SSOT — 이미지 URL 없이 키워드만 저장 */
    if ('imageKeyword' in body && !imageUrl) {
      const kw = body.imageKeyword == null ? '' : String(body.imageKeyword).trim().slice(0, 500)
      let schedule: ScheduleEntry[] = []
      try {
        const parsed = JSON.parse(product.schedule ?? '[]') as unknown
        schedule = Array.isArray(parsed) ? (parsed as ScheduleEntry[]) : []
      } catch {
        schedule = []
      }
      let updated = false
      const next = schedule.map((item) => {
        if (Number(item.day) !== day) return item
        updated = true
        return { ...item, imageKeyword: kw || `day_${day}` }
      })
      if (!updated) {
        next.push({
          day,
          title: `DAY ${day}`,
          description: '',
          imageKeyword: kw || `day_${day}`,
        })
      }
      next.sort((a, b) => Number(a.day ?? 0) - Number(b.day ?? 0))
      await prisma.product.update({
        where: { id },
        data: { schedule: JSON.stringify(next) },
      })
      return NextResponse.json({ ok: true, productId: id, day, imageKeyword: kw, imageUrl: null })
    }
    let schedule: ScheduleEntry[] = []
    try {
      const parsed = JSON.parse(product.schedule ?? '[]') as unknown
      schedule = Array.isArray(parsed) ? (parsed as ScheduleEntry[]) : []
    } catch {
      schedule = []
    }

    const source = String(body.source ?? 'manual').trim().slice(0, 100) || 'manual'
    const photographer = body.photographer == null ? null : String(body.photographer).trim().slice(0, 200) || null
    const originalLink = body.originalLink == null ? null : String(body.originalLink).trim().slice(0, 2000) || null
    const externalId = body.externalId == null ? null : String(body.externalId).trim().slice(0, 100) || null
    const manualSelected = body.manualSelected !== false
    const selectionMode = body.selectionMode == null ? null : String(body.selectionMode).trim().slice(0, 50) || null

    const trimOpt = (v: unknown, max: number): string | null => {
      if (v == null) return null
      const t = String(v).trim().slice(0, max)
      return t || null
    }
    let resolvedSeoKr = trimOpt(body.imageSeoTitleKr, 400)

    let updated = false
    const clearManualOnly = body.manualSelected === false && !imageUrl
    if (!clearManualOnly && !imageUrl) {
      return NextResponse.json({ error: 'imageUrl이 필요합니다.' }, { status: 400 })
    }

    if (!clearManualOnly && imageUrl && !resolvedSeoKr && /^https?:\/\//i.test(imageUrl)) {
      try {
        const asset = await findImageAssetByPublicUrl(imageUrl)
        if (asset) {
          const fromAsset = (asset.seo_title_kr || asset.title_kr || '').trim()
          if (fromAsset) resolvedSeoKr = fromAsset.slice(0, 400)
        }
      } catch {
        /* Prisma image_assets 조회 실패 시 이미지 URL만 저장 */
      }
    }

    const resolvedAttraction = trimOpt(body.imageAttractionName, 400)
    const resolvedDisplayManual = trimOpt(body.imageDisplayNameManual, 400)
    let prevImageUrl: string | null = null
    let nextImageUrl: string | null = null
    let nextSourceType: string | null = null
    let nextSelectionMode: string | null = null
    const next = schedule.map((item) => {
      if (Number(item.day) !== day) return item
      updated = true
      prevImageUrl = typeof item.imageUrl === 'string' ? item.imageUrl : null
      if (clearManualOnly) {
        return {
          ...item,
          imageManualSelected: false,
          imageSelectionMode: null,
        }
      }
      nextImageUrl = imageUrl
      nextSourceType = source
      nextSelectionMode = selectionMode
      const itemRest: ScheduleEntry = { ...item }
      delete itemRest.imageSeoTitleKr
      delete itemRest.imageAttractionName
      delete itemRest.imageDisplayNameManual
      return {
        ...itemRest,
        imageUrl,
        imageSource: {
          source,
          photographer: photographer ?? source,
          originalLink: originalLink ?? '',
          externalId,
        },
        imageManualSelected: manualSelected,
        imageSelectionMode: selectionMode,
        imageCandidateOrigin: manualSelected ? 'manual' : item.imageCandidateOrigin ?? null,
        ...(resolvedSeoKr ? { imageSeoTitleKr: resolvedSeoKr } : {}),
        ...(resolvedAttraction ? { imageAttractionName: resolvedAttraction } : {}),
        ...(resolvedDisplayManual ? { imageDisplayNameManual: resolvedDisplayManual } : {}),
      }
    })
    if (!updated && !clearManualOnly) {
      nextImageUrl = imageUrl
      nextSourceType = source
      nextSelectionMode = selectionMode
      next.push({
        day,
        title: `DAY ${day}`,
        description: '',
        imageKeyword: `day_${day}`,
        imageUrl,
        imageSource: {
          source,
          photographer: photographer ?? source,
          originalLink: originalLink ?? '',
          externalId,
        },
        imageManualSelected: manualSelected,
        imageSelectionMode: selectionMode,
        imageCandidateOrigin: manualSelected ? 'manual' : null,
        ...(resolvedSeoKr ? { imageSeoTitleKr: resolvedSeoKr } : {}),
        ...(resolvedAttraction ? { imageAttractionName: resolvedAttraction } : {}),
        ...(resolvedDisplayManual ? { imageDisplayNameManual: resolvedDisplayManual } : {}),
      })
    }
    next.sort((a, b) => Number(a.day ?? 0) - Number(b.day ?? 0))

    await prisma.product.update({
      where: { id },
      data: { schedule: JSON.stringify(next) },
    })

    if (clearManualOnly) {
      await recordAssetUsage({
        productId: id,
        day,
        selectionMode: 'auto-revert',
        sourceType: 'auto-selected',
        actorType: 'admin',
        actorId: admin.user.id ?? null,
        notes: 'manual lock cleared',
      })
    } else if (nextImageUrl) {
      const mode = normalizeSelectionMode(nextSelectionMode ?? 'manual-pick', nextSourceType ?? source)
      await recordAssetUsage({
        assetId: externalId,
        assetPath: nextImageUrl,
        productId: id,
        day,
        selectionMode: mode,
        sourceType: nextSourceType ?? source,
        actorType: 'admin',
        actorId: admin.user.id ?? null,
        notes: prevImageUrl && prevImageUrl !== nextImageUrl ? `replaced:${prevImageUrl}` : null,
      })
    }

    return NextResponse.json({ ok: true, productId: id, day, imageUrl: imageUrl || null, source, manualSelected })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }
}
