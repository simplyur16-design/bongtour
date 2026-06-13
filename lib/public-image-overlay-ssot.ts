/**
 * 사용자 화면 이미지 내부 표기 SSOT — 좌측 SEO 키워드 / 우측 출처만.
 * 관리자·업로드 폼과 분리한다.
 */

import {
  productHeroAttributionBadgeFromImageUrl,
  productHeroAttributionBadgeText,
} from '@/lib/product-bg-image-attribution'
import { resolveCanonicalImageSourceForDisplay } from '@/lib/product-image-source-attribution'

/** 우측 출처: DB(bgImageSource 등) 우선, 없으면 이미지 URL·파일명 추정. raw enum 미노출. */
export function resolvePublicImageSourceUserLabel(params: {
  dbSource?: string | null
  dbIsGenerated?: boolean | null
  imageUrl?: string | null
  originalLink?: string | null
}): string | null {
  const canonical = resolveCanonicalImageSourceForDisplay({
    dbSource: params.dbSource,
    imageUrl: params.imageUrl,
    originalLink: params.originalLink,
    poolSource: params.dbSource,
  })
  const fromCanonical = productHeroAttributionBadgeText(canonical, params.dbIsGenerated)
  if (fromCanonical && fromCanonical !== '사진풀') return fromCanonical
  const fromDb = productHeroAttributionBadgeText(params.dbSource, params.dbIsGenerated)
  if (fromDb && fromDb !== '사진풀') return fromDb
  return productHeroAttributionBadgeFromImageUrl(params.imageUrl)
}

export function publicImageOverlayHasAny(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean((left ?? '').trim() || (right ?? '').trim())
}

/** 공개 이미지 우측 출처 — Pexels 스톡·작가 크레딧(모바일 숨김 대상). AI·iStock 등은 제외. */
export function isGenericPexelsStockPublicOverlayLabel(label: string | null | undefined): boolean {
  const t = (label ?? '').trim().replace(/\s+/g, ' ')
  if (!t) return false
  if (/^pexels\s*스톡\s*이미지$/i.test(t)) return true
  if (/^pexels\s*스톡이미지$/i.test(t)) return true
  if (/^photo by .+ on pexels$/i.test(t)) return true
  return false
}

/** 모바일에서 우측 출처만 숨길 때 Tailwind 클래스 */
export function publicImageOverlayRightLabelMobileClass(label: string | null | undefined): string {
  return isGenericPexelsStockPublicOverlayLabel(label) ? 'hidden md:inline' : ''
}

/**
 * 모바일에서 오버레이 전체를 숨길지 — 좌 SEO 없고 우측이 Pexels 출처만일 때.
 */
export function publicImageOverlayHideOnMobile(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const l = (left ?? '').trim()
  const r = (right ?? '').trim()
  return !l && Boolean(r) && isGenericPexelsStockPublicOverlayLabel(r)
}

/** 일정 day 이미지 우측 출처 — ProductHeroCarousel day 슬라이드와 동일 규칙 */
export function resolveScheduleDayImageRightLabel(params: {
  imageUrl?: string | null
  imagePhotographer?: string | null
  imageSource?: string | null
  imageSourcePageUrl?: string | null
}): string | null {
  const photographer = (params.imagePhotographer ?? '').trim()
  const canonical = resolveCanonicalImageSourceForDisplay({
    poolSource: params.imageSource,
    dbSource: params.imageSource,
    imageUrl: params.imageUrl,
    originalLink: params.imageSourcePageUrl,
  })
  const dSrc = canonical ?? (params.imageSource ?? '').trim().toLowerCase()
  if (photographer && dSrc) {
    const sourceLabel =
      dSrc === 'pexels' ? 'Pexels' : dSrc === 'unsplash' ? 'Unsplash' : dSrc === 'istock' ? 'iStock' : dSrc
    if (!/^pexels$/i.test(photographer)) {
      return `Photo by ${photographer} on ${sourceLabel}`
    }
  }
  if (dSrc === 'pexels') return 'Pexels 스톡이미지'
  if (dSrc === 'unsplash') return 'Unsplash 스톡이미지'
  return resolvePublicImageSourceUserLabel({
    dbSource: dSrc || null,
    imageUrl: params.imageUrl,
    originalLink: params.imageSourcePageUrl,
  })
}

/** 메인 허브 등 자체 스톡 사진 — DB 출처 없을 때 우측 고정 문구 */
export const PUBLIC_GENERIC_STOCK_IMAGE_SOURCE_LABEL = '제공 이미지'
