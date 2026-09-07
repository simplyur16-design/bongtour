/**
 * 등록대기 Pexels 클릭 — PhotoPool 재호스팅은 응답 후. 클릭은 즉시 저장.
 * REGRESSION-FREEZE[pending-pexels-pick-fast-persist]: persist CDN immediately; PhotoPool rehost after() — manifest
 */
import type { PrismaClient } from '@prisma/client'
import { getImageStorageBucket, isObjectStorageConfigured, tryParseObjectKeyFromPublicUrl } from '@/lib/object-storage'
import { findPhotoPoolBySourcePhotoId, savePhotoFromUrlWithRetry } from '@/lib/photo-pool'
import { extractPexelsPhotoIdFromCdnUrl, isPexelsCdnUrl } from '@/lib/product-pexels-image-rehost'
import { toHeroStorageSourceTypeSegment } from '@/lib/product-hero-image-source-type'
import { internalizeProductCoverImageUrl } from '@/lib/travel-product-image-internalize'

export type PendingPexelsPersistResolution = {
  persistUrl: string
  alreadyPooled: boolean
  needsBackgroundRehost: boolean
}

export async function resolvePendingPexelsPersistUrl(
  prisma: PrismaClient,
  remoteUrl: string,
  sourcePhotoId: string | null | undefined,
): Promise<PendingPexelsPersistResolution> {
  const u = String(remoteUrl ?? '').trim()
  if (!u) {
    return { persistUrl: u, alreadyPooled: false, needsBackgroundRehost: false }
  }
  if (tryParseObjectKeyFromPublicUrl(u)) {
    return { persistUrl: u, alreadyPooled: true, needsBackgroundRehost: false }
  }
  const sidFromArg = (sourcePhotoId ?? '').trim()
  const sidFromUrl = isPexelsCdnUrl(u) ? String(extractPexelsPhotoIdFromCdnUrl(u) ?? '') : ''
  const sid = sidFromArg && sidFromArg !== 'null' ? sidFromArg : sidFromUrl
  if (sid && sid !== 'null') {
    const hit = await findPhotoPoolBySourcePhotoId(prisma, sid)
    if (hit?.filePath) {
      return { persistUrl: hit.filePath, alreadyPooled: true, needsBackgroundRehost: false }
    }
  }
  const needsBackgroundRehost = isObjectStorageConfigured() && /^https?:\/\//i.test(u)
  return { persistUrl: u, alreadyPooled: false, needsBackgroundRehost }
}

export type PendingScheduleSlotRehostJob = {
  productId: string
  day: number
  imageSlot: 1 | 2
  expectedCdnUrl: string
  cityName: string
  attractionName: string
  source: string
  photographer: string | null
  sourceUrl: string | null
  sourcePhotoId: string | null
}

function readSourceObj(row: Record<string, unknown>, slot: 1 | 2): Record<string, unknown> {
  const key = slot === 2 ? 'imageSource2' : 'imageSource'
  const v = row[key]
  if (v && typeof v === 'object' && !Array.isArray(v)) return { ...(v as Record<string, unknown>) }
  return {}
}

/**
 * 클릭 응답 후 PhotoPool 재호스트. 슬롯 URL이 아직 원본 CDN이면만 교체(다른 사진으로 바꾼 경우 덮지 않음).
 */
export async function rehostPendingScheduleSlotIfUnchanged(
  prisma: PrismaClient,
  job: PendingScheduleSlotRehostJob,
): Promise<boolean> {
  const rec = await savePhotoFromUrlWithRetry(
    prisma,
    job.expectedCdnUrl,
    job.cityName,
    job.attractionName,
    job.source,
    {
      retries: 2,
      baseDelayMs: 300,
      attribution: {
        photographer: job.photographer,
        sourceUrl: job.sourceUrl,
        sourcePhotoId: job.sourcePhotoId,
      },
    },
  )
  if (!rec?.filePath) return false

  const product = await prisma.product.findUnique({
    where: { id: job.productId },
    select: { schedule: true },
  })
  if (!product) return false

  let rows: Array<Record<string, unknown>> = []
  try {
    const parsed = JSON.parse(product.schedule ?? '[]') as unknown
    rows = Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : []
  } catch {
    return false
  }

  const urlField = job.imageSlot === 2 ? 'imageUrl2' : 'imageUrl'
  let changed = false
  const next = rows.map((row) => {
    if (Number(row.day) !== job.day) return row
    const currentUrl = row[urlField] != null ? String(row[urlField]).trim() : ''
    const srcObj = readSourceObj(row, job.imageSlot)
    const sourceImageUrl =
      typeof srcObj.sourceImageUrl === 'string' ? srcObj.sourceImageUrl.trim() : ''
    if (currentUrl !== job.expectedCdnUrl && sourceImageUrl !== job.expectedCdnUrl) {
      return row
    }
    changed = true
    const key = tryParseObjectKeyFromPublicUrl(rec.filePath)
    const nextSource = {
      ...srcObj,
      sourceType: toHeroStorageSourceTypeSegment(job.source),
      sourceImageUrl: job.expectedCdnUrl,
      ...(rec.sourcePhotoId || job.sourcePhotoId
        ? { externalId: rec.sourcePhotoId ?? job.sourcePhotoId }
        : {}),
    }
    if (job.imageSlot === 2) {
      return { ...row, imageUrl2: rec.filePath, imageSource2: nextSource }
    }
    return {
      ...row,
      imageUrl: rec.filePath,
      imageSource: nextSource,
      imageStoragePath: key,
      imageStorageBucket: key ? getImageStorageBucket() : null,
    }
  })
  if (!changed) return false

  await prisma.product.update({
    where: { id: job.productId },
    data: { schedule: JSON.stringify(next) },
  })
  return true
}

export type PendingCoverRehostJob = {
  productId: string
  expectedCdnUrl: string
  destination: string
  poolAttractionLabel: string
  poolSource: string
  pexelsPhotoId: number | null
  photographer: string | null
  pexelsPageUrl: string | null
  searchKeyword: string | null
  placeName: string | null
  cityName: string | null
  sourceTypeSegment: string
}

/**
 * 대표 이미지 클릭 응답 후 PhotoPool 내부화. bgImageUrl이 아직 원본 CDN이면만 교체.
 * PATCH 라우트는 `internalizeProductCoverImageUrl` 문자열을 유지해야 한다(pexels-primary-single-ingest).
 */
export async function rehostPendingCoverIfUnchanged(
  prisma: PrismaClient,
  job: PendingCoverRehostJob,
): Promise<boolean> {
  const current = await prisma.product.findUnique({
    where: { id: job.productId },
    select: { bgImageUrl: true },
  })
  if (String(current?.bgImageUrl ?? '').trim() !== job.expectedCdnUrl) return false

  const internalized = await internalizeProductCoverImageUrl(prisma, {
    remoteUrl: job.expectedCdnUrl,
    destination: job.destination,
    poolAttractionLabel: job.poolAttractionLabel,
    poolSource: job.poolSource,
    pexelsPhotoId: job.pexelsPhotoId,
    photographer: job.photographer,
    pexelsPageUrl: job.pexelsPageUrl,
    searchKeyword: job.searchKeyword,
    placeName: job.placeName,
    cityName: job.cityName,
  })
  const afterRow = await prisma.product.findUnique({
    where: { id: job.productId },
    select: { bgImageUrl: true },
  })
  if (String(afterRow?.bgImageUrl ?? '').trim() !== job.expectedCdnUrl) return false

  const key = tryParseObjectKeyFromPublicUrl(internalized)
  await prisma.product.update({
    where: { id: job.productId },
    data: {
      bgImageUrl: internalized,
      bgImageStoragePath: key,
      bgImageStorageBucket: key ? getImageStorageBucket() : null,
      bgImageRehostedAt: new Date(),
      bgImageSourceType: job.sourceTypeSegment,
      bgImageRehostSearchLabel: job.searchKeyword,
      bgImagePlaceName: job.placeName,
      bgImageCityName: job.cityName,
    },
  })
  return true
}
