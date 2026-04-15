/**
 * Pexels CDN 이미지를 다운로드해 Supabase Storage에 올리고 공개 URL을 만든다.
 * 경로·파일명 규칙(SSOT): `{geo-slug}-{source}-{sourceId}.{ext}`
 * - 관광지(place)만: places/{place-slug}/{place-slug}-pexels-{id}.{ext}
 * - 도시(city)만: cities/{city-slug}/{city-slug}-pexels-{id}.{ext}
 * - 둘 다: cities/{city-slug}/{place-slug}-pexels-{id}.{ext}
 * - geo 없음: places/unknown/unknown-pexels-{id}.{ext}
 * slug는 toAssetSlug(라틴·하이픈, 소문자). source는 `toHeroStorageSourceTypeSegment`와 동일 키.
 */

import sharp from 'sharp'
import {
  uploadStorageObject,
  getImageStorageBucket,
  isObjectStorageConfigured,
  tryParseObjectKeyFromPublicUrl,
} from '@/lib/object-storage'
import { toAssetSlug } from '@/lib/image-asset-slug'
import { toHeroStorageSourceTypeSegment, sanitizeHeroStorageSourceIdSegment } from '@/lib/product-hero-image-source-type'

export type ProductPexelsRehostInput = {
  /** Pexels large/medium 등 실제 바이너리 URL */
  downloadUrl: string
  pexelsPhotoId: number
  photographer: string | null
  /** Pexels 사진 페이지 URL (저장 시 bgImageSourceUrl) */
  pexelsPageUrl: string | null
  /** 검색에 쓴 키워드(운영 라벨) */
  searchKeyword: string | null
  placeName: string | null
  cityName: string | null
}

export type ProductPexelsRehostResult = {
  publicUrl: string
  objectKey: string
  bucket: string
  width: number | null
  height: number | null
  /** 저장에 쓴 folder 규칙 설명용 */
  pathPattern: 'places-only' | 'cities-only' | 'city-with-place'
  /** 파일명·DB `bgImageSourceType`과 동일 */
  sourceTypeSegment: string
  placeNameStored: string | null
  cityNameStored: string | null
  searchLabelStored: string | null
}

/** `.../photos/{id}/...` 형태의 Pexels CDN URL에서 숫자 id 추출 */
export function extractPexelsPhotoIdFromCdnUrl(url: string): number | null {
  const m = /\/photos\/(\d+)\//i.exec(url)
  if (m) {
    const n = Number(m[1])
    return Number.isInteger(n) && n > 0 ? n : null
  }
  return null
}

export function isPexelsCdnUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.hostname === 'images.pexels.com' || u.hostname.endsWith('.pexels.com')
  } catch {
    return false
  }
}

export function extFromContentType(ct: string | null, fallbackFromUrl: string): string {
  const c = (ct ?? '').toLowerCase()
  if (c.includes('jpeg') || c.includes('jpg')) return 'jpg'
  if (c.includes('png')) return 'png'
  if (c.includes('webp')) return 'webp'
  if (c.includes('gif')) return 'gif'
  const m = /\.([a-zA-Z0-9]{1,8})(?:\?|$)/.exec(fallbackFromUrl)
  if (m) {
    const e = m[1].toLowerCase()
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(e)) return e === 'jpeg' ? 'jpg' : e
  }
  return 'jpg'
}

/** 대표 히어로 이미지 Supabase object key (파일명에 source·고유 id 포함) */
export function buildProductHeroImageStorageKey(input: {
  placeSlug: string | null
  citySlug: string | null
  /** 파일명 세그먼트 — DB bgImageSourceType과 동일해야 함 */
  sourceTypeSegment: string
  /** Pexels photo id, short hash 등 */
  sourceIdSegment: string
  ext: string
}): { objectKey: string; pathPattern: ProductPexelsRehostResult['pathPattern'] } {
  const place = input.placeSlug?.trim() || null
  const city = input.citySlug?.trim() || null
  const safeExt = input.ext.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg'
  const src = sanitizeHeroStorageSourceIdSegment(input.sourceTypeSegment)
  const sid = sanitizeHeroStorageSourceIdSegment(input.sourceIdSegment)
  const stem = (geo: string) => `${geo}-${src}-${sid}`

  if (place && city) {
    return {
      objectKey: `cities/${city}/${stem(place)}.${safeExt}`,
      pathPattern: 'city-with-place',
    }
  }
  if (place) {
    return {
      objectKey: `places/${place}/${stem(place)}.${safeExt}`,
      pathPattern: 'places-only',
    }
  }
  if (city) {
    return {
      objectKey: `cities/${city}/${stem(city)}.${safeExt}`,
      pathPattern: 'cities-only',
    }
  }
  const geo = 'unknown'
  return {
    objectKey: `places/${geo}/${stem(geo)}.${safeExt}`,
    pathPattern: 'places-only',
  }
}

export async function downloadRemoteImage(
  url: string,
  opts?: { maxBytes?: number }
): Promise<{ buffer: Buffer; contentType: string | null }> {
  const maxBytes = opts?.maxBytes ?? 25 * 1024 * 1024
  const res = await fetch(url, {
    headers: {
      Accept: 'image/*',
      'User-Agent': 'BongTour-Admin-PexelsRehost/1.0',
    },
    redirect: 'follow',
  })
  if (!res.ok) {
    throw new Error(`이미지 다운로드 실패 HTTP ${res.status}`)
  }
  const len = res.headers.get('content-length')
  if (len && Number(len) > maxBytes) {
    throw new Error('이미지 용량이 허용 한도를 초과했습니다.')
  }
  const ab = await res.arrayBuffer()
  if (ab.byteLength > maxBytes) {
    throw new Error('이미지 용량이 허용 한도를 초과했습니다.')
  }
  return {
    buffer: Buffer.from(ab),
    contentType: res.headers.get('content-type'),
  }
}

/**
 * Pexels CDN URL이면 다운로드 후 Supabase 업로드.
 * 이미 Supabase public URL이면 그대로 반환(재업로드 생략).
 */
export async function rehostPexelsProductHeroIfNeeded(input: ProductPexelsRehostInput): Promise<ProductPexelsRehostResult> {
  const downloadUrl = String(input.downloadUrl ?? '').trim()
  if (!downloadUrl) {
    throw new Error('다운로드 URL이 비어 있습니다.')
  }

  if (!isObjectStorageConfigured()) {
    throw new Error('Supabase Storage가 설정되지 않았습니다.')
  }

  let publicUrl = downloadUrl
  let objectKey = ''
  let bucket = getImageStorageBucket()
  let width: number | null = null
  let height: number | null = null
  let pathPattern: ProductPexelsRehostResult['pathPattern'] = 'places-only'

  const placeRaw = input.placeName?.trim() || null
  const cityRaw = input.cityName?.trim() || null
  const searchLabel = input.searchKeyword?.trim() || null

  const placeSlug = placeRaw ? toAssetSlug(placeRaw) : null
  const citySlug = cityRaw ? toAssetSlug(cityRaw) : null

  const parsedKey = tryParseObjectKeyFromPublicUrl(downloadUrl)
  const alreadyOurStorage = Boolean(parsedKey)

  const sourceTypeSegment = toHeroStorageSourceTypeSegment('pexels')

  if (alreadyOurStorage) {
    return {
      publicUrl: downloadUrl,
      objectKey: parsedKey ?? '',
      bucket,
      width: null,
      height: null,
      pathPattern: placeSlug && citySlug ? 'city-with-place' : placeSlug ? 'places-only' : 'cities-only',
      sourceTypeSegment,
      placeNameStored: placeRaw,
      cityNameStored: cityRaw,
      searchLabelStored: searchLabel,
    }
  }

  if (!isPexelsCdnUrl(downloadUrl)) {
    throw new Error('Pexels 재호스팅은 images.pexels.com 등 Pexels CDN URL만 지원합니다.')
  }

  const { buffer, contentType } = await downloadRemoteImage(downloadUrl)
  const ext = extFromContentType(contentType, downloadUrl)

  const built = buildProductHeroImageStorageKey({
    placeSlug,
    citySlug,
    sourceTypeSegment,
    sourceIdSegment: String(input.pexelsPhotoId),
    ext,
  })
  objectKey = built.objectKey
  pathPattern = built.pathPattern

  const uploadContentType =
    contentType?.split(';')[0]?.trim() ||
    (ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : `image/${ext}`)

  try {
    const meta = await sharp(buffer).metadata()
    width = meta.width ?? null
    height = meta.height ?? null
  } catch {
    // 메타데이터 없이도 업로드는 진행
  }

  const up = await uploadStorageObject({
    objectKey,
    body: buffer,
    contentType: uploadContentType,
  })

  return {
    publicUrl: up.publicUrl,
    objectKey: up.objectKey,
    bucket: up.bucket,
    width,
    height,
    pathPattern,
    sourceTypeSegment,
    placeNameStored: placeRaw,
    cityNameStored: cityRaw,
    searchLabelStored: searchLabel,
  }
}
