/**
 * 등록대기 키워드·요약 가드 — 클라이언트에서도 import 가능 (서버 캐시 API 금지).
 * REGRESSION-FREEZE[pending-pre-photo-verify-client-safe]: verify는 self-heal 서버 체인을 끌어오지 않음 — manifest
 */
import {
  isAirlineCarrierImageKeyword,
  isHotelLodgingImageKeyword,
  isNonLandmarkFoodOrDiningImageKeyword,
  isNonLandmarkSpaShoppingLoungeImageKeyword,
} from '@/lib/pexels-place-name-keyword'
import { tryPersistScheduleImageKeyword } from '@/lib/schedule-image-keyword-persist'

const FILLER_DESC_RE =
  /하루 동안 여러 장면이 자연스럽게|특정 장소보다 전체적인|명소 나열보다 분위기와 리듬/u
const DUP_GENERIC_CLOSER_RE = /동선에 맞춰(?:\s+하루)?\s+일정을 이어갑니다/gu

export type RegisterPrePhotoHealRow = {
  day: number
  title?: string | null
  description?: string | null
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
  imageUrl?: string | null
}

export function isBrokenRegisterLandmarkKeyword(keyword: string | null | undefined): boolean {
  const t = String(keyword ?? '').trim()
  if (!t) return false
  if (isHotelLodgingImageKeyword(t)) return true
  if (isNonLandmarkFoodOrDiningImageKeyword(t)) return true
  if (isAirlineCarrierImageKeyword(t)) return true
  if (isNonLandmarkSpaShoppingLoungeImageKeyword(t)) return true
  const persist = tryPersistScheduleImageKeyword(t)
  return !persist.ok
}

export function isBrokenRegisterScheduleDescription(
  description: string | null | undefined,
  routeText?: string | null,
): boolean {
  const t = String(description ?? '').trim()
  if (t.length < 12) return true
  if (FILLER_DESC_RE.test(t)) return true
  const genericHits = t.match(DUP_GENERIC_CLOSER_RE)
  if (genericHits && genericHits.length >= 2) return true
  const sentences = t
    .split(/(?<=다\.)\s+/u)
    .map((s) => s.trim())
    .filter(Boolean)
  for (let i = 1; i < sentences.length; i++) {
    if (sentences[i] === sentences[i - 1]) return true
  }
  void routeText
  return false
}
