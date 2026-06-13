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

/** 공개 이미지 우측 출처 — AI 생성 문구만 노출 대상 */
export function isAiGeneratedPublicOverlayRightLabel(label: string | null | undefined): boolean {
  const t = (label ?? '').trim().replace(/\s+/g, ' ')
  if (!t) return false
  return /^AI(\s*생성|\s*로\s*(만들|생성))/i.test(t)
}

/** 공개 화면에 실제로 그릴 우측 출처 — AI 생성만, 나머지 숨김 */
export function publicImageOverlayRightLabelForDisplay(label: string | null | undefined): string | null {
  const t = (label ?? '').trim()
  return isAiGeneratedPublicOverlayRightLabel(t) ? t : null
}

/** 메인 허브 등 자체 스톡 사진 — DB 출처 없을 때 우측 고정 문구 */
export const PUBLIC_GENERIC_STOCK_IMAGE_SOURCE_LABEL = '제공 이미지'
