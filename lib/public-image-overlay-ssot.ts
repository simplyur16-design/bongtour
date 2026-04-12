/**
 * 사용자 화면 이미지 내부 표기 SSOT — 좌측 SEO 키워드 / 우측 출처만.
 * 관리자·업로드 폼과 분리한다.
 */

import {
  productHeroAttributionBadgeFromImageUrl,
  productHeroAttributionBadgeText,
} from '@/lib/product-bg-image-attribution'

/** 우측 출처: DB(bgImageSource 등) 우선, 없으면 이미지 URL·파일명 추정. raw enum 미노출. */
export function resolvePublicImageSourceUserLabel(params: {
  dbSource?: string | null
  dbIsGenerated?: boolean | null
  imageUrl?: string | null
}): string | null {
  const fromDb = productHeroAttributionBadgeText(params.dbSource, params.dbIsGenerated)
  if (fromDb) return fromDb
  return productHeroAttributionBadgeFromImageUrl(params.imageUrl)
}

export function publicImageOverlayHasAny(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean((left ?? '').trim() || (right ?? '').trim())
}

/** 메인 허브 등 자체 스톡 사진 — DB 출처 없을 때 우측 고정 문구 */
export const PUBLIC_GENERIC_STOCK_IMAGE_SOURCE_LABEL = '제공 이미지'
