/**
 * 일정 JSON 슬롯의 Pexels CDN 이미지를 Supabase Storage로 재호스팅.
 * 경로: schedules/{productId}/{day}/{geo-slug}-{source}-{pexelsId}.{ext}
 * stem 규칙은 대표 히어로(`buildProductHeroImageStorageKey`)와 동일 철학(place+city→place 우선 등).
 */

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
import {
  downloadRemoteImage,
  extractPexelsPhotoIdFromCdnUrl,
  extFromContentType,
  isPexelsCdnUrl,
} from '@/lib/product-pexels-image-rehost'

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

/**
 * schedule 배열의 각 행에서 Pexels CDN `imageUrl`만 Supabase 공개 URL로 바꾼다.
 * Storage 미설정 시 입력 그대로 반환.
 */
export async function rehostPexelsUrlsInScheduleEntries(
  productId: string,
  entries: ScheduleEntryRecord[],
  resolveMeta: (day: number, row: ScheduleEntryRecord) => ScheduleMetaForDay
): Promise<ScheduleEntryRecord[]> {
  if (!isObjectStorageConfigured()) return entries
  const out: ScheduleEntryRecord[] = []
  for (const row of entries) {
    out.push(await rehostOneScheduleRowIfPexels(productId, row, resolveMeta))
  }
  return out
}

async function rehostOneScheduleRowIfPexels(
  productId: string,
  row: ScheduleEntryRecord,
  resolveMeta: (day: number, row: ScheduleEntryRecord) => ScheduleMetaForDay
): Promise<ScheduleEntryRecord> {
  const urlRaw = row.imageUrl != null ? String(row.imageUrl).trim() : ''
  if (!urlRaw) return row
  if (tryParseObjectKeyFromPublicUrl(urlRaw)) return row
  if (!isPexelsCdnUrl(urlRaw)) return row

  const day = Number(row.day) || 1
  const meta = resolveMeta(day, row)
  const srcObj = readImageSource(row)
  const idBody = srcObj.externalId != null ? String(srcObj.externalId).trim() : ''
  const pidFromBody = idBody ? Number(idBody) : NaN
  const pidFromUrl = extractPexelsPhotoIdFromCdnUrl(urlRaw)
  const pid =
    Number.isInteger(pidFromBody) && pidFromBody > 0 ? pidFromBody : pidFromUrl != null ? pidFromUrl : NaN
  if (!Number.isInteger(pid) || pid <= 0) return row

  const pageUrl = typeof srcObj.originalLink === 'string' ? srcObj.originalLink.trim() || null : null
  const photographer =
    typeof srcObj.photographer === 'string' ? srcObj.photographer.trim() || null : null
  const sourceLabel = typeof srcObj.source === 'string' ? srcObj.source.trim() : 'pexels'

  try {
    const rh = await rehostPexelsScheduleDayImageIfNeeded({
      downloadUrl: urlRaw,
      productId,
      day,
      pexelsPhotoId: pid,
      photographer,
      pexelsPageUrl: pageUrl,
      searchKeyword: meta.searchKeyword ?? meta.placeName ?? meta.cityName ?? null,
      placeName: meta.placeName,
      cityName: meta.cityName,
    })
    const nextSource: Record<string, unknown> = {
      ...srcObj,
      source: sourceLabel || 'pexels',
      sourceType: rh.sourceTypeSegment,
      photographer: photographer ?? sourceLabel ?? 'pexels',
      originalLink: pageUrl ?? '',
      externalId: String(pid),
      sourceImageUrl: urlRaw,
    }
    return {
      ...row,
      imageUrl: rh.publicUrl,
      imageSource: nextSource,
      imageStoragePath: rh.objectKey || null,
      imageStorageBucket: rh.objectKey ? rh.bucket : null,
      imageRehostSearchLabel: rh.searchLabelStored,
      imagePlaceName: rh.placeNameStored,
      imageCityName: rh.cityNameStored,
      imageWidth: rh.width,
      imageHeight: rh.height,
    }
  } catch (e) {
    console.warn('[schedule-day-image-rehost] row skip', productId, day, e)
    return row
  }
}
