/**
 * 상품·목록·히어로 공용 커버 화질 SSOT.
 * 저장본은 선명하게, 목록은 Next Image sizes + quality로 용량 조절.
 * REGRESSION-FREEZE[cover-image-quality]: sharp master + list display quality — manifest
 */

/** PhotoPool·커버 WebP 저장 상한 (히어로·카드 동일 마스터) */
export const COVER_IMAGE_WEBP_MAX_WIDTH = 2400
/** PhotoPool·커버 WebP 품질 */
export const COVER_IMAGE_WEBP_QUALITY = 88

/** 목록·비교 카드 Next Image quality (sizes로 실제 전송 해상도 제한) */
export const COVER_IMAGE_LIST_NEXT_QUALITY = 80

/** 브라우저 업로드 사전 리사이즈 — 서버 WebP와 맞춤 */
export const COVER_IMAGE_BROWSER_UPLOAD_MAX_WIDTH = 2400
export const COVER_IMAGE_BROWSER_UPLOAD_JPEG_QUALITY = 0.9

export type PexelsSrcLike = {
  original?: string
  large2x?: string
  large?: string
  medium?: string
} | null | undefined

/** 커버 인제스트용 — original 우선(저장 시 WebP 상한으로 축소). */
export function pickPexelsCoverIngestUrl(src: PexelsSrcLike): string {
  // REGRESSION-FREEZE[cover-image-quality]: prefer Pexels original for cover — manifest
  return (
    src?.original?.trim() ||
    src?.large2x?.trim() ||
    src?.large?.trim() ||
    src?.medium?.trim() ||
    ''
  )
}
