/**
 * 상품·일정 이미지 공개 출처 SSOT — PhotoPool(photo-pool/) 저장이어도 원천(Pexels 등)을 우선 표기.
 * REGRESSION-FREEZE[product-image-source-attribution]: Pexels → 사진풀 오표기 금지 — manifest
 */
import { toHeroStorageSourceTypeSegment } from '@/lib/product-hero-image-source-type'
import { trailingSourceTokenFromImageUrl } from '@/lib/webp-filename'

export type PhotoAttributionLike = {
  url?: string | null
  source?: string | null
  photographer?: string | null
  originalLink?: string | null
  externalId?: string | null
}

/** PhotoPool.source·imageSource.source 등 → DB `bgImageSource` / 공개 배지용 canonical 키 */
export function canonicalProductImageSourceKey(
  raw: string | null | undefined,
  hints?: { imageUrl?: string | null; originalLink?: string | null }
): string | null {
  const s = (raw ?? '').trim()
  const lower = s.toLowerCase()
  if (/^pexels$/i.test(s)) return 'pexels'
  if (lower === 'gemini' || lower === 'gemini_auto' || lower === 'gemini_manual') return lower
  if (lower === 'istock') return 'istock'
  if (lower === 'unsplash') return 'unsplash'
  if (lower === 'manual' || lower === 'upload' || lower === 'photo_owned') return lower
  if (lower === 'destination-set' || lower === 'city-asset' || lower === 'attraction-asset') return lower

  const link = (hints?.originalLink ?? '').trim()
  if (/pexels\.com/i.test(link)) return 'pexels'
  if (/unsplash\.com/i.test(link)) return 'unsplash'

  const fromUrl = inferSourceKeyFromImageUrl(hints?.imageUrl)
  if (fromUrl) return fromUrl

  if (lower === 'photopool' || lower === 'photo pool' || lower === 'ingest') return null
  if (!s) return null
  return lower
}

/** URL·파일명에서 pexels/istock 등 출처 키 추정 (`*__hash` 접미사·`city-place-pexels-id` 형식 포함) */
export function inferSourceKeyFromImageUrl(url: string | null | undefined): string | null {
  const raw = String(url ?? '').trim()
  if (!raw) return null
  const pathOnly = raw.split('?')[0] ?? raw
  const base = pathOnly.replace(/^.*[/\\]/, '').replace(/\.[a-z0-9]{2,5}$/i, '')
  if (!base) return null
  if (/[-_]pexels[-_]/i.test(base)) return 'pexels'
  if (/[-_]istock[-_]/i.test(base)) return 'istock'
  if (/[-_]gemini[-_]/i.test(base)) return 'gemini'
  const trailing = trailingSourceTokenFromImageUrl(raw)
  if (trailing) {
    const t = trailing.toLowerCase()
    if (t === 'pexels') return 'pexels'
    if (t === 'istock') return 'istock'
    if (t === 'gemini' || t === 'gemini_auto' || t === 'gemini_manual') return t
  }
  return null
}

export function resolveCanonicalImageSourceForDisplay(params: {
  dbSource?: string | null
  imageUrl?: string | null
  originalLink?: string | null
  poolSource?: string | null
}): string | null {
  const fromPool = canonicalProductImageSourceKey(params.poolSource, {
    imageUrl: params.imageUrl,
    originalLink: params.originalLink,
  })
  if (fromPool) return fromPool
  const fromDb = canonicalProductImageSourceKey(params.dbSource, {
    imageUrl: params.imageUrl,
    originalLink: params.originalLink,
  })
  if (fromDb) return fromDb
  return inferSourceKeyFromImageUrl(params.imageUrl)
}

export function resolveProductBgImageFieldsFromPhoto(photo: PhotoAttributionLike): {
  bgImageSource: string | null
  bgImageSourceType: string | null
  bgImagePhotographer: string | null
  bgImageSourceUrl: string | null
  bgImageExternalId: string | null
} {
  const sourceKey = resolveCanonicalImageSourceForDisplay({
    dbSource: photo.source,
    imageUrl: photo.url,
    originalLink: photo.originalLink,
    poolSource: photo.source,
  })
  const photographerRaw = (photo.photographer ?? '').trim()
  const photographer =
    photographerRaw && !/^pexels$/i.test(photographerRaw) && photographerRaw !== photo.source
      ? photographerRaw
      : photographerRaw && !/^pexels$/i.test(photographerRaw)
        ? photographerRaw
        : null
  return {
    bgImageSource: sourceKey,
    bgImageSourceType: sourceKey ? toHeroStorageSourceTypeSegment(sourceKey) : null,
    bgImagePhotographer: photographer,
    bgImageSourceUrl: (photo.originalLink ?? '').trim() || null,
    bgImageExternalId: photo.externalId != null ? String(photo.externalId).trim() || null : null,
  }
}

/** schedule imageSource.source — 공개 배지용 lowercase canonical */
export function normalizeScheduleImageSourceLabel(raw: string | null | undefined, imageUrl?: string | null): string {
  const key = resolveCanonicalImageSourceForDisplay({
    poolSource: raw,
    dbSource: raw,
    imageUrl,
  })
  return key ?? (raw ?? '').trim().toLowerCase() || 'pexels'
}
