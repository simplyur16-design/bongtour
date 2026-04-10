/**
 * 상품 대표 이미지(Product.bgImage*) 출처 표기 — 공개 히어로 배지와 동일 규칙 + 관리자용 타입 라벨.
 */
import { isAllowedImageSourceType, sourceTypeToSourceName, type ImageSourceType } from '@/lib/image-asset-source'
import { inferSourceFromFilename, trailingSourceTokenFromImageUrl } from '@/lib/webp-filename'

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
 * 공개 상세 히어로 배지: DB 출처 타입별 문구 + Gemini는 생성 플래그에 따라 AI 문구.
 * URL·파일명 추정은 `productHeroAttributionBadgeFromImageUrl`.
 */
export function productHeroAttributionBadgeText(
  sourceType: string | null | undefined,
  isGenerated: boolean | null | undefined
): string | null {
  const s = (sourceType ?? '').trim().toLowerCase()
  if (!s) return null
  if (s === 'pexels') return 'Pexels 스톡 이미지'
  if (s === 'istock') return 'iStock 이미지'
  const geminiFamily = s === 'gemini' || s === 'gemini_auto' || s === 'gemini_manual'
  if (geminiFamily && isGenerated === true) return 'AI로 만들었습니다'
  if (geminiFamily) return 'Gemini 이미지'
  if (s === 'photopool') return '사진풀'
  if (s === 'manual' || s === 'upload' || s === 'photo_owned' || s === 'other') return '제공 이미지'
  if (s === 'destination-set') return '도시 이미지'
  if (s === 'city-asset') return '도시 자료'
  if (s === 'attraction-asset') return '관광지 자료'
  return null
}

/** 파일명·URL 마지막 `_` 출처 토큰 또는 스톡 접두(iStock-…) → 공개 배지 문구 */
function publicBadgeFromFilenameToken(token: string): string | null {
  const t = token.trim()
  if (!t) return null
  const lower = t.toLowerCase()
  if (lower === 'pexels') return 'Pexels 스톡 이미지'
  if (lower === 'istock') return 'iStock 이미지'
  if (lower === 'gemini' || lower === 'gemini_auto' || lower === 'gemini_manual') return 'Gemini 이미지'
  if (lower === 'photopool') return '사진풀'
  if (lower === 'manual' || lower === 'upload' || lower === 'photo_owned' || lower === 'other') return '제공 이미지'
  if (lower === 'destination-set') return '도시 이미지'
  if (lower === 'city-asset') return '도시 자료'
  if (lower === 'attraction-asset') return '관광지 자료'
  const inferred = inferSourceFromFilename(`${t}.png`)
  if (inferred === 'iStock') return 'iStock 이미지'
  if (inferred === 'Pexels') return 'Pexels 스톡 이미지'
  if (inferred) return `${inferred} 이미지`
  return null
}

/**
 * 공개 히어로·일정 슬라이드: DB 출처 없을 때 URL basename에서 출처 추정 (도시_명소_Pexels.webp 등).
 */
export function productHeroAttributionBadgeFromImageUrl(url: string | null | undefined): string | null {
  const raw = String(url ?? '').trim()
  if (!raw) return null
  const pathOnly = raw.split('?')[0] ?? raw
  const base = pathOnly.replace(/^.*[/\\]/, '').replace(/\.[a-z0-9]{2,5}$/i, '')
  if (!base) return null
  const fromFull = inferSourceFromFilename(`${base}.png`)
  if (fromFull === 'iStock') return 'iStock 이미지'
  if (fromFull === 'Pexels') return 'Pexels 스톡 이미지'
  if (fromFull) return `${fromFull} 이미지`
  const trailing = trailingSourceTokenFromImageUrl(raw)
  if (trailing) return publicBadgeFromFilenameToken(trailing)
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
