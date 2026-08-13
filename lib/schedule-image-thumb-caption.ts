/**
 * 일정 DAY 썸네일 하단·alt용 짧은 라벨 — URL 파일명·인코딩 깨짐은 노출하지 않음.
 * REGRESSION-FREEZE[schedule-image-seo-title-ssot]: 영문 키워드·DAYN 오염 캡션 금지 — manifest
 */
import { isPollutedScheduleImageSeoTitle } from '@/lib/schedule-image-seo-title-ssot'

const ENCODED_RUN_RE = /%[0-9A-Fa-f]{2}/
const STORAGE_NOISE_RE =
  /^(?:schedules\/|unknown-|premade|day[_\s-]?\d|slot\d|pexels|photo-?\d+)/i

function tryDecodeLabel(raw: string): string {
  let s = raw.trim()
  if (!s) return ''
  try {
    if (ENCODED_RUN_RE.test(s)) {
      s = decodeURIComponent(s.replace(/\+/g, ' '))
    }
  } catch {
    /* keep raw */
  }
  return s.replace(/\s+/g, ' ').trim()
}

/** 공개 썸네일·alt에 쓰기 부적합한 문자열 */
export function isUnusableScheduleThumbCaption(value: string | null | undefined): boolean {
  const t = tryDecodeLabel(String(value ?? ''))
  if (!t) return true
  if (ENCODED_RUN_RE.test(t)) return true
  if (t.length > 72) return true
  if (STORAGE_NOISE_RE.test(t)) return true
  if (/^https?:\/\//i.test(t)) return true
  if ((t.match(/\//g) ?? []).length >= 2) return true
  if (isPollutedScheduleImageSeoTitle(t)) return true
  return false
}

export function resolveScheduleThumbCaption(input: {
  imageKeyword?: string | null
  imageSeoTitleKr?: string | null
  imageAttractionName?: string | null
  imageDisplayNameManual?: string | null
  imageSourceFileName?: string | null
  derivedFromUrl?: string | null
}): string | null {
  const candidates = [
    input.imageSeoTitleKr,
    input.imageDisplayNameManual,
    input.imageAttractionName,
    input.imageSourceFileName,
    input.derivedFromUrl,
  ]
  for (const c of candidates) {
    const t = tryDecodeLabel(String(c ?? ''))
    if (!t || isUnusableScheduleThumbCaption(t)) continue
    return t.slice(0, 80)
  }
  return null
}
