/**
 * 상품 대표 이미지(Product.bgImage*) 출처 표기 — 공개 히어로 배지와 동일 규칙 + 관리자용 타입 라벨.
 */
import { isAllowedImageSourceType, sourceTypeToSourceName, type ImageSourceType } from '@/lib/image-asset-source'

/** Product.bgImageSource 전용(이미지 자산 source_type 외 키) */
const PRODUCT_BG_SOURCE_EXTRA_LABEL: Record<string, string> = {
  gemini: 'Gemini',
  manual: '수동',
  'destination-set': '도시세트',
  photopool: '사진풀',
  other: '기타',
  'city-asset': '도시자산',
  'attraction-asset': '관광지',
}

/**
 * 공개 상세 히어로 배지와 동일: Pexels / iStock / (Gemini 계열 + is_generated)일 때만 AI 문구.
 */
export function productHeroAttributionBadgeText(
  sourceType: string | null | undefined,
  isGenerated: boolean | null | undefined
): string | null {
  const s = (sourceType ?? '').trim().toLowerCase()
  if (s === 'pexels') return 'Pexels 스톡 이미지'
  if (s === 'istock') return 'iStock 이미지'
  const geminiFamily = s === 'gemini' || s === 'gemini_auto' || s === 'gemini_manual'
  if (geminiFamily && isGenerated === true) return 'AI로 만들었습니다'
  return null
}

/** 관리자·목록: image-asset source_type은 SSOT 이름, 그 외는 상품 전용 보조 라벨, 없으면 raw */
export function adminProductBgImageSourceTypeLabel(source: string | null | undefined): string {
  const trimmed = (source ?? '').trim()
  const raw = trimmed.toLowerCase()
  if (!raw) return 'legacy'
  if (isAllowedImageSourceType(raw)) {
    return sourceTypeToSourceName(raw as ImageSourceType)
  }
  return PRODUCT_BG_SOURCE_EXTRA_LABEL[raw] ?? trimmed
}

/**
 * 관리자 카드/요약 한 줄: 공개 배지 규칙 우선, 없으면 타입 라벨(bgImageIsGenerated 반영).
 */
export function adminProductBgImageAttributionLine(
  source: string | null | undefined,
  isGenerated: boolean | null | undefined
): string {
  return productHeroAttributionBadgeText(source, isGenerated) ?? adminProductBgImageSourceTypeLabel(source)
}
