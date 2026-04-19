/**
 * 일정 JSON 슬롯 이미지를 Supabase Storage로만 남기도록 정리한다.
 * 1) `http(s)` 외부 URL → **PhotoPool(WebP)만** 저장 (Pexels·기타 외부 동일, schedules/ 우회 없음)
 * 2) Pool 실패 시 `imageUrl` 제거 + `sourceImageUrl`에 원본 보존(추적)
 * stem 규칙은 대표 히어로(`buildProductHeroImageStorageKey`)와 동일 철학(place+city→place 우선 등).
 */

import type { PrismaClient } from '@prisma/client'
import sharp from 'sharp'
import {
  uploadStorageObject,
  getImageStorageBucket,
  isObjectStorageConfigured,
  tryParseObjectKeyFromPublicUrl,
} from '@/lib/object-storage'
import { toAssetSlug } from '@/lib/image-asset-slug'
import {
  toHeroStorageSourceTypeSegment,
  sanitizeHeroStorageSourceIdSegment,
} from '@/lib/product-hero-image-source-type'
import { downloadRemoteImage, extFromContentType, isPexelsCdnUrl } from '@/lib/product-pexels-image-rehost'
import { savePhotoFromUrlWithRetry } from '@/lib/photo-pool'

export type ScheduleEntryRecord = Record<string, unknown>

export function sanitizeProductIdForSchedulePath(id: string): string {
  const t = String(id ?? '').trim()
  const s = t.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120)
  return s || 'product'
}

export function buildScheduleDayImageObjectKey(input: {
  productId: string
  day: number
  placeSlug: string | null
  citySlug: string | null
  sourceTypeSegment: string
  sourceIdSegment: string
  ext: string
}): string {
  const pid = sanitizeProductIdForSchedulePath(input.productId)
  const d = Number.isInteger(input.day) && input.day > 0 ? input.day : 1
  const place = input.placeSlug?.trim() || null
  const city = input.citySlug?.trim() || null
  const src = sanitizeHeroStorageSourceIdSegment(input.sourceTypeSegment)
  const sid = sanitizeHeroStorageSourceIdSegment(input.sourceIdSegment)
  const safeExt = input.ext.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg'
  let stem: string
  if (place && city) stem = `${place}-${src}-${sid}`
  else if (place) stem = `${place}-${src}-${sid}`
  else if (city) stem = `${city}-${src}-${sid}`
  else stem = `unknown-${src}-${sid}`
  return `schedules/${pid}/${d}/${stem}.${safeExt}`
}

export type ScheduleDayPexelsRehostInput = {
  downloadUrl: string
  productId: string
  day: number
  pexelsPhotoId: number
  photographer: string | null
  pexelsPageUrl: string | null
  searchKeyword: string | null
  placeName: string | null
  cityName: string | null
}

export type ScheduleDayPexelsRehostResult = {
  publicUrl: string
  objectKey: string
  bucket: string
  width: number | null
  height: number | null
  sourceTypeSegment: string
  placeNameStored: string | null
  cityNameStored: string | null
  searchLabelStored: string | null
}

export async function rehostPexelsScheduleDayImageIfNeeded(
  input: ScheduleDayPexelsRehostInput
): Promise<ScheduleDayPexelsRehostResult> {
  const downloadUrl = String(input.downloadUrl ?? '').trim()
  if (!downloadUrl) throw new Error('다운로드 URL이 비어 있습니다.')
  if (!isObjectStorageConfigured()) throw new Error('Supabase Storage가 설정되지 않았습니다.')

  const bucket = getImageStorageBucket()
  const parsedKey = tryParseObjectKeyFromPublicUrl(downloadUrl)
  const sourceTypeSegment = toHeroStorageSourceTypeSegment('pexels')
  const placeRaw = input.placeName?.trim() || null
  const cityRaw = input.cityName?.trim() || null
  const searchLabel = input.searchKeyword?.trim() || null
  const placeSlug = placeRaw ? toAssetSlug(placeRaw) : null
  const citySlug = cityRaw ? toAssetSlug(cityRaw) : null

  if (parsedKey) {
    return {
      publicUrl: downloadUrl,
      objectKey: parsedKey,
      bucket,
      width: null,
      height: null,
      sourceTypeSegment,
      placeNameStored: placeRaw,
      cityNameStored: cityRaw,
      searchLabelStored: searchLabel,
    }
  }

  if (!isPexelsCdnUrl(downloadUrl)) {
    throw new Error('일정 Pexels 재호스팅은 Pexels CDN URL만 지원합니다.')
  }

  const { buffer, contentType } = await downloadRemoteImage(downloadUrl)
  const ext = extFromContentType(contentType, downloadUrl)
  const objectKey = buildScheduleDayImageObjectKey({
    productId: input.productId,
    day: input.day,
    placeSlug,
    citySlug,
    sourceTypeSegment,
    sourceIdSegment: String(input.pexelsPhotoId),
    ext,
  })
  let width: number | null = null
  let height: number | null = null
  try {
    const meta = await sharp(buffer).metadata()
    width = meta.width ?? null
    height = meta.height ?? null
  } catch {
    //
  }
  const uploadContentType =
    contentType?.split(';')[0]?.trim() ||
    (ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : `image/${ext}`)
  const up = await uploadStorageObject({ objectKey, body: buffer, contentType: uploadContentType })
  return {
    publicUrl: up.publicUrl,
    objectKey: up.objectKey,
    bucket: up.bucket,
    width,
    height,
    sourceTypeSegment,
    placeNameStored: placeRaw,
    cityNameStored: cityRaw,
    searchLabelStored: searchLabel,
  }
}

export type ScheduleMetaForDay = {
  placeName: string | null
  cityName: string | null
  searchKeyword: string | null
}

function readImageSource(row: ScheduleEntryRecord): Record<string, unknown> {
  const v = row.imageSource
  if (v && typeof v === 'object' && !Array.isArray(v)) return { ...(v as Record<string, unknown>) }
  return {}
}

function rowWithClearedExternalImage(
  row: ScheduleEntryRecord,
  srcObj: Record<string, unknown>,
  urlRaw: string,
  reason: string
): ScheduleEntryRecord {
  console.warn('[schedule-day-image-rehost] cleared external imageUrl', reason, urlRaw.slice(0, 120))
  return {
    ...row,
    imageUrl: null,
    imageSource: {
      ...srcObj,
      sourceImageUrl: urlRaw,
      internalizationFailed: reason,
    },
  }
}

/**
 * schedule 배열의 각 행에서 외부 `http(s)` imageUrl을 **PhotoPool 공개 URL**로만 바꾼다.
 * Storage 미설정 시 입력 그대로 반환.
 */
export async function rehostPexelsUrlsInScheduleEntries(
  prisma: PrismaClient,
  productId: string,
  entries: ScheduleEntryRecord[],
  resolveMeta: (day: number, row: ScheduleEntryRecord) => ScheduleMetaForDay
): Promise<ScheduleEntryRecord[]> {
  if (!isObjectStorageConfigured()) return entries
  const out: ScheduleEntryRecord[] = []
  for (const row of entries) {
    out.push(await finalizeOneScheduleRowImageUrl(prisma, productId, row, resolveMeta))
  }
  return out
}

async function finalizeOneScheduleRowImageUrl(
  prisma: PrismaClient,
  productId: string,
  row: ScheduleEntryRecord,
  resolveMeta: (day: number, row: ScheduleEntryRecord) => ScheduleMetaForDay
): Promise<ScheduleEntryRecord> {
  const urlRaw = row.imageUrl != null ? String(row.imageUrl).trim() : ''
  if (!urlRaw) return row
  if (tryParseObjectKeyFromPublicUrl(urlRaw)) return row
  if (!/^https?:\/\//i.test(urlRaw)) return row

  const day = Number(row.day) || 1
  const meta = resolveMeta(day, row)
  const srcObj = readImageSource(row)
  const sourceLabelRaw = typeof srcObj.source === 'string' ? srcObj.source.trim() : ''
  const sourceLabel = sourceLabelRaw || 'ingest'
  const pageUrl = typeof srcObj.originalLink === 'string' ? srcObj.originalLink.trim() || null : null
  const photographer =
    typeof srcObj.photographer === 'string' ? srcObj.photographer.trim() || null : null

  const cityForPool = meta.cityName?.trim() || 'unknown'
  const attractionForPool =
    (meta.placeName?.trim() ||
      meta.searchKeyword?.trim() ||
      (typeof row.imageKeyword === 'string' ? row.imageKeyword.trim() : '') ||
      `schedule_day_${day}`).slice(0, 80) || `schedule_day_${day}`

  const poolRec = await savePhotoFromUrlWithRetry(prisma, urlRaw, cityForPool, attractionForPool, sourceLabel)
  if (poolRec) {
    const key = tryParseObjectKeyFromPublicUrl(poolRec.filePath)
    const nextSource: Record<string, unknown> = {
      ...srcObj,
      source: sourceLabel,
      sourceType: toHeroStorageSourceTypeSegment(sourceLabel),
      photographer: photographer ?? sourceLabel,
      originalLink: pageUrl ?? '',
      sourceImageUrl: urlRaw,
    }
    return {
      ...row,
      imageUrl: poolRec.filePath,
      imageSource: nextSource,
      imageStoragePath: key,
      imageStorageBucket: key ? getImageStorageBucket() : null,
      imageRehostSearchLabel: meta.searchKeyword ?? meta.placeName ?? meta.cityName ?? null,
      imagePlaceName: meta.placeName,
      imageCityName: meta.cityName,
      imageWidth: null,
      imageHeight: null,
    }
  }

  return rowWithClearedExternalImage(row, srcObj, urlRaw, 'photo-pool-ingest-failed')
}
