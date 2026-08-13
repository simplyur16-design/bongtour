import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { recordAssetUsage, normalizeSelectionMode } from '@/lib/asset-usage-log'
import { findImageAssetByPublicUrl } from '@/lib/image-assets-db'
import { getImageStorageBucket, isObjectStorageConfigured, tryParseObjectKeyFromPublicUrl } from '@/lib/object-storage'
import { savePhotoFromUrlWithRetry } from '@/lib/photo-pool'
import { extractPexelsPhotoIdFromCdnUrl, isPexelsCdnUrl } from '@/lib/product-pexels-image-rehost'
import { toHeroStorageSourceTypeSegment } from '@/lib/product-hero-image-source-type'
import {
  persistScheduleImageFields,
  persistScheduleImageKeyword,
  ScheduleImageKeywordPersistError,
} from '@/lib/schedule-image-keyword-persist'
import {
  isPollutedScheduleImageSeoTitle,
  resolveScheduleImageSeoTitleKr,
  SCHEDULE_IMAGE_SEO_TITLE_MAX,
} from '@/lib/schedule-image-seo-title-ssot'

type RouteParams = { params: Promise<{ id: string }> }

type ScheduleEntry = {
  day?: number
  title?: string
  description?: string
  imageKeyword?: string
  imageKeyword2?: string | null
  imageUrl?: string | null
  imageUrl2?: string | null
  imageSource?: {
    source?: string
    photographer?: string
    originalLink?: string
    externalId?: string | null
    /** canonical — 파일명 source 세그먼트와 동일 */
    sourceType?: string
    /** 재호스팅 전 Pexels CDN 등 원본 다운로드 URL */
    sourceImageUrl?: string | null
  }
  imageManualSelected?: boolean
  imageSelectionMode?: string | null
  imageCandidateOrigin?: string | null
  /** image_assets SEO / 관리자 명시 — 공개 캡션 우선(getScheduleFromProduct) */
  imageSeoTitleKr?: string | null
  imageAttractionName?: string | null
  imageDisplayNameManual?: string | null
  imageStoragePath?: string | null
  imageStorageBucket?: string | null
  imageRehostSearchLabel?: string | null
  imagePlaceName?: string | null
  imageCityName?: string | null
  routeText?: string | null
  imageWidth?: number | null
  imageHeight?: number | null
  imageSource2?: {
    source?: string
    photographer?: string
    originalLink?: string
    externalId?: string | null
    sourceType?: string
    sourceImageUrl?: string | null
  }
  imageDisplayName2?: string | null
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
      imageKeyword2?: string | null
      source?: string
      photographer?: string | null
      originalLink?: string | null
      externalId?: string | null
      manualSelected?: boolean
      selectionMode?: string | null
      imageSeoTitleKr?: string | null
      imageAttractionName?: string | null
      imageDisplayNameManual?: string | null
      imagePlaceName?: string | null
      imageCityName?: string | null
      imageSearchKeyword?: string | null
      /** 1 = imageUrl(기본), 2 = imageUrl2(2순위) */
      imageSlot?: number
    }
    const day = Number(body.day)
    const imageSlot = body.imageSlot === 2 ? 2 : 1
    if (!Number.isInteger(day) || day < 1) {
      return NextResponse.json({ error: '유효한 day가 필요합니다.' }, { status: 400 })
    }
    const imageUrl = String(body.imageUrl ?? '').trim().slice(0, 2000)
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        schedule: true,
        title: true,
        destination: true,
        primaryDestination: true,
        destinationRaw: true,
      },
    })
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    /** 일정별 Pexels/Gemini 검색어 SSOT — 이미지 URL 없이 키워드만 저장 */
    if (('imageKeyword' in body || 'imageKeyword2' in body) && !imageUrl) {
      let schedule: ScheduleEntry[] = []
      try {
        const parsed = JSON.parse(product.schedule ?? '[]') as unknown
        schedule = Array.isArray(parsed) ? (parsed as ScheduleEntry[]) : []
      } catch {
        schedule = []
      }
      let persistedKw: string | undefined
      let persistedKw2: string | null | undefined
      try {
        if ('imageKeyword' in body) {
          persistedKw = persistScheduleImageKeyword(body.imageKeyword)
        }
        if ('imageKeyword2' in body) {
          const raw2 = body.imageKeyword2
          persistedKw2 =
            raw2 == null || String(raw2).trim() === ''
              ? null
              : persistScheduleImageKeyword(raw2)
        }
      } catch (e) {
        const msg =
          e instanceof ScheduleImageKeywordPersistError
            ? e.message
            : 'imageKeyword 형식이 올바르지 않습니다.'
        return NextResponse.json({ error: msg }, { status: 400 })
      }
      let updated = false
      const next = schedule.map((item) => {
        if (Number(item.day) !== day) return item
        updated = true
        const patch: ScheduleEntry = { ...item }
        if (persistedKw !== undefined) patch.imageKeyword = persistedKw
        if (persistedKw2 !== undefined) patch.imageKeyword2 = persistedKw2
        return persistScheduleImageFields(patch)
      })
      if (!updated) {
        next.push(
          persistScheduleImageFields({
            day,
            title: `DAY ${day}`,
            description: '',
            imageKeyword: persistedKw ?? '',
            imageKeyword2: persistedKw2 ?? null,
          }),
        )
      }
      next.sort((a, b) => Number(a.day ?? 0) - Number(b.day ?? 0))
      await prisma.product.update({
        where: { id },
        data: { schedule: JSON.stringify(next) },
      })
      const savedRow = next.find((x) => Number(x.day) === day)
      return NextResponse.json({
        ok: true,
        productId: id,
        day,
        imageKeyword: savedRow?.imageKeyword ?? persistedKw ?? null,
        imageKeyword2: savedRow?.imageKeyword2 ?? persistedKw2 ?? null,
        imageUrl: null,
        // REGRESSION-FREEZE[admin-pending-photo-register-local-patch]: keyword 응답으로 로컬 schedule 패치 — manifest
        dayEntry: savedRow ?? null,
      })
    }
    let schedule: ScheduleEntry[] = []
    try {
      const parsed = JSON.parse(product.schedule ?? '[]') as unknown
      schedule = Array.isArray(parsed) ? (parsed as ScheduleEntry[]) : []
    } catch {
      schedule = []
    }

    const sourceRaw = String(body.source ?? 'manual').trim().slice(0, 100)
    const source = sourceRaw || 'manual'
    const photographer = body.photographer == null ? null : String(body.photographer).trim().slice(0, 200) || null
    const originalLink = body.originalLink == null ? null : String(body.originalLink).trim().slice(0, 2000) || null
    const externalIdFromBody = body.externalId == null ? null : String(body.externalId).trim().slice(0, 100) || null
    let externalIdResolved: string | null = externalIdFromBody
    const manualSelected = body.manualSelected !== false
    const selectionMode = body.selectionMode == null ? null : String(body.selectionMode).trim().slice(0, 50) || null

    const trimOpt = (v: unknown, max: number): string | null => {
      if (v == null) return null
      const t = String(v).trim().slice(0, max)
      return t || null
    }

    let updated = false
    const clearManualOnly = body.manualSelected === false && !imageUrl
    if (!clearManualOnly && !imageUrl) {
      return NextResponse.json({ error: 'imageUrl이 필요합니다.' }, { status: 400 })
    }

    const currentRow = schedule.find((x) => Number(x.day) === day)
    const maxDay = Math.max(day, ...schedule.map((x) => Number(x.day) || 0), 1)
    const destHint =
      product.primaryDestination?.trim() ||
      product.destinationRaw?.trim() ||
      product.destination?.trim() ||
      null
    const currentRoute =
      typeof currentRow?.routeText === 'string' && currentRow.routeText.trim()
        ? currentRow.routeText.trim()
        : null
    // REGRESSION-FREEZE[schedule-image-seo-title-ssot]: 저장 시 한글 일차 명소 제목, 사진풀 DAYN·영문 키워드 금지 — manifest
    let resolvedSeoKr = resolveScheduleImageSeoTitleKr({
      stored: trimOpt(body.imageSeoTitleKr, 400),
      day,
      maxDay,
      routeText: currentRoute,
      destination: destHint,
      productTitle: product.title,
    })
    if (resolvedSeoKr) resolvedSeoKr = resolvedSeoKr.slice(0, SCHEDULE_IMAGE_SEO_TITLE_MAX)
    const scheduleKw =
      imageSlot === 2
        ? typeof currentRow?.imageKeyword2 === 'string'
          ? currentRow.imageKeyword2.trim()
          : ''
        : typeof currentRow?.imageKeyword === 'string'
          ? currentRow.imageKeyword.trim()
          : ''
    let persistedImageUrl = imageUrl
    let rehostExtra: Partial<ScheduleEntry> = {}
    let rehostedSourceType: string | null = null
    let originalCdnUrlForMeta: string | null = null
    if (
      !clearManualOnly &&
      imageUrl &&
      isObjectStorageConfigured() &&
      /^https?:\/\//i.test(imageUrl) &&
      tryParseObjectKeyFromPublicUrl(imageUrl) == null
    ) {
      const cityFromBody =
        body.imageCityName == null ? null : String(body.imageCityName).trim().slice(0, 200) || null
      const placeFromBody =
        body.imagePlaceName == null ? null : String(body.imagePlaceName).trim().slice(0, 200) || null
      const searchFromBody =
        body.imageSearchKeyword == null ? null : String(body.imageSearchKeyword).trim().slice(0, 300) || null
      const placeFromKw = scheduleKw ? scheduleKw.split(/[|,]/)[0]?.trim() || null : null
      const cityFallback =
        cityFromBody != null
          ? cityFromBody
          : destHint
      let persistedMeta: ReturnType<typeof persistScheduleImageFields>
      try {
        persistedMeta = persistScheduleImageFields({
          imageKeyword: scheduleKw || null,
          imagePlaceName: placeFromBody ?? placeFromKw,
          imageRehostSearchLabel:
            searchFromBody != null
              ? searchFromBody
              : placeFromBody != null
                ? placeFromBody
                : (placeFromKw ?? cityFallback ?? scheduleKw) || null,
        })
      } catch (e) {
        const msg =
          e instanceof ScheduleImageKeywordPersistError
            ? e.message
            : 'imagePlaceName·검색 라벨 형식이 올바르지 않습니다.'
        return NextResponse.json({ error: msg }, { status: 400 })
      }
      const placeName = persistedMeta.imagePlaceName
      const cityName = cityFallback
      const searchLabel = persistedMeta.imageRehostSearchLabel
      const poolCity = (cityName ?? 'unknown').trim() || 'unknown'
      const poolAttraction =
        (resolvedSeoKr || placeName || searchLabel || scheduleKw || `여행`).slice(0, 80) || '여행'
      originalCdnUrlForMeta = imageUrl

      // REGRESSION-FREEZE[pexels-primary-single-ingest]: schedule day — reuse PhotoPool by Pexels id — manifest
      const pexelsIdForPool =
        externalIdResolved ||
        (isPexelsCdnUrl(imageUrl) ? String(extractPexelsPhotoIdFromCdnUrl(imageUrl) ?? '') : '') ||
        null
      const poolRec = await savePhotoFromUrlWithRetry(
        prisma,
        imageUrl,
        poolCity,
        poolAttraction,
        source || 'manual',
        {
          attribution: {
            photographer,
            sourceUrl: originalLink,
            sourcePhotoId: pexelsIdForPool && pexelsIdForPool !== 'null' ? pexelsIdForPool : null,
          },
        },
      )
      if (poolRec) {
        const key = tryParseObjectKeyFromPublicUrl(poolRec.filePath)
        persistedImageUrl = poolRec.filePath
        rehostedSourceType = toHeroStorageSourceTypeSegment(source)
        rehostExtra = {
          imageStoragePath: key,
          imageStorageBucket: key ? getImageStorageBucket() : null,
          imageRehostSearchLabel: searchLabel,
          imagePlaceName: placeName,
          imageCityName: cityName,
          imageWidth: null,
          imageHeight: null,
        }
      } else {
        const hint = isPexelsCdnUrl(imageUrl)
          ? 'Pexels 이미지도 PhotoPool 저장에 실패했습니다. 잠시 후 다시 시도하거나 다른 사진을 선택해 주세요.'
          : '외부 이미지를 PhotoPool에 저장하지 못했습니다. 다른 URL을 선택하거나 잠시 후 다시 시도해 주세요.'
        return NextResponse.json({ error: hint }, { status: 503 })
      }
    }

    if (!clearManualOnly && persistedImageUrl && !resolvedSeoKr && /^https?:\/\//i.test(persistedImageUrl)) {
      try {
        const asset = await findImageAssetByPublicUrl(persistedImageUrl)
        if (asset) {
          const fromAsset = (asset.seo_title_kr || asset.title_kr || '').trim()
          if (fromAsset && !isPollutedScheduleImageSeoTitle(fromAsset)) {
            resolvedSeoKr = fromAsset.slice(0, SCHEDULE_IMAGE_SEO_TITLE_MAX)
          }
        }
      } catch {
        /* Prisma image_assets 조회 실패 시 이미지 URL만 저장 */
      }
    }

    const attractionRaw = trimOpt(body.imageAttractionName, 400)
    const resolvedAttraction =
      attractionRaw && !isPollutedScheduleImageSeoTitle(attractionRaw)
        ? attractionRaw.slice(0, SCHEDULE_IMAGE_SEO_TITLE_MAX)
        : null
    const resolvedDisplayManual = trimOpt(body.imageDisplayNameManual, 400)
    let prevImageUrl: string | null = null
    let nextImageUrl: string | null = null
    let nextSourceType: string | null = null
    let nextSelectionMode: string | null = null
    const next = schedule.map((item) => {
      if (Number(item.day) !== day) return item
      updated = true
      prevImageUrl =
        imageSlot === 2
          ? typeof item.imageUrl2 === 'string'
            ? item.imageUrl2
            : null
          : typeof item.imageUrl === 'string'
            ? item.imageUrl
            : null
      if (clearManualOnly) {
        if (imageSlot === 2) {
          const cleared: ScheduleEntry = { ...item, imageUrl2: null }
          delete cleared.imageSource2
          delete cleared.imageDisplayName2
          return cleared
        }
        return {
          ...item,
          imageManualSelected: false,
          imageSelectionMode: null,
        }
      }
      nextImageUrl = persistedImageUrl
      nextSourceType = source
      nextSelectionMode = selectionMode
      const itemRest: ScheduleEntry = { ...item }
      delete itemRest.imageSeoTitleKr
      delete itemRest.imageAttractionName
      delete itemRest.imageDisplayNameManual
      if (imageSlot === 2) {
        return persistScheduleImageFields({
          ...itemRest,
          imageUrl2: persistedImageUrl,
          imageSource2: {
            source,
            sourceType: rehostedSourceType ?? undefined,
            photographer: photographer ?? source,
            originalLink: originalLink ?? '',
            externalId: externalIdResolved,
            ...(originalCdnUrlForMeta ? { sourceImageUrl: originalCdnUrlForMeta } : {}),
          },
          ...(resolvedDisplayManual ? { imageDisplayName2: resolvedDisplayManual } : {}),
        })
      }
      return persistScheduleImageFields({
        ...itemRest,
        ...rehostExtra,
        imageUrl: persistedImageUrl,
        imageSource: {
          source,
          sourceType: rehostedSourceType ?? undefined,
          photographer: photographer ?? source,
          originalLink: originalLink ?? '',
          externalId: externalIdResolved,
          ...(originalCdnUrlForMeta ? { sourceImageUrl: originalCdnUrlForMeta } : {}),
        },
        imageManualSelected: manualSelected,
        imageSelectionMode: selectionMode,
        imageCandidateOrigin: manualSelected ? 'manual' : item.imageCandidateOrigin ?? null,
        ...(resolvedSeoKr ? { imageSeoTitleKr: resolvedSeoKr } : {}),
        ...(resolvedAttraction ? { imageAttractionName: resolvedAttraction } : {}),
        ...(resolvedDisplayManual ? { imageDisplayNameManual: resolvedDisplayManual } : {}),
      })
    })
    if (!updated && !clearManualOnly) {
      nextImageUrl = persistedImageUrl
      nextSourceType = source
      nextSelectionMode = selectionMode
      if (imageSlot === 2) {
        next.push(
          persistScheduleImageFields({
            day,
            title: `DAY ${day}`,
            description: '',
            imageKeyword2: scheduleKw ? persistScheduleImageKeyword(scheduleKw) : '',
            imageUrl2: persistedImageUrl,
            imageSource2: {
              source,
              sourceType: rehostedSourceType ?? undefined,
              photographer: photographer ?? source,
              originalLink: originalLink ?? '',
              externalId: externalIdResolved,
              ...(originalCdnUrlForMeta ? { sourceImageUrl: originalCdnUrlForMeta } : {}),
            },
            ...(resolvedDisplayManual ? { imageDisplayName2: resolvedDisplayManual } : {}),
          }),
        )
      } else {
        next.push(
          persistScheduleImageFields({
            day,
            title: `DAY ${day}`,
            description: '',
            imageKeyword: scheduleKw ? persistScheduleImageKeyword(scheduleKw) : '',
            ...rehostExtra,
            imageUrl: persistedImageUrl,
            imageSource: {
              source,
              sourceType: rehostedSourceType ?? undefined,
              photographer: photographer ?? source,
              originalLink: originalLink ?? '',
              externalId: externalIdResolved,
              ...(originalCdnUrlForMeta ? { sourceImageUrl: originalCdnUrlForMeta } : {}),
            },
            imageManualSelected: manualSelected,
            imageSelectionMode: selectionMode,
            imageCandidateOrigin: manualSelected ? 'manual' : null,
            ...(resolvedSeoKr ? { imageSeoTitleKr: resolvedSeoKr } : {}),
            ...(resolvedAttraction ? { imageAttractionName: resolvedAttraction } : {}),
            ...(resolvedDisplayManual ? { imageDisplayNameManual: resolvedDisplayManual } : {}),
          }),
        )
      }
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
        assetId: externalIdResolved,
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

    return NextResponse.json({
      ok: true,
      productId: id,
      day,
      imageSlot,
      imageUrl: clearManualOnly ? null : persistedImageUrl || null,
      source,
      manualSelected,
      // REGRESSION-FREEZE[admin-pending-photo-register-local-patch]: apply 응답 dayEntry로 full product GET 생략 — manifest
      dayEntry: next.find((x) => Number(x.day) === day) ?? null,
    })
  } catch (e) {
    console.error(e)
    const dev = process.env.NODE_ENV === 'development'
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      {
        error: dev
          ? `처리 중 오류: ${detail.slice(0, 500)}`
          : '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      },
      { status: 500 }
    )
  }
}
