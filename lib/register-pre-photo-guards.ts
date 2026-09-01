/**
 * 등록대기 키워드·요약 가드 — 클라이언트에서도 import 가능 (서버 캐시 API 금지).
 * REGRESSION-FREEZE[pending-pre-photo-verify-client-safe]: verify는 self-heal 서버 체인을 끌어오지 않음 — manifest
 * REGRESSION-FREEZE[register-pre-photo-self-heal]: 파라도르·식사 키워드 가드 — manifest
 * REGRESSION-FREEZE[pexels-normalize-da-nang-not-da]: Da·Nha 조각 키워드는 검증 실패 — manifest
 * REGRESSION-FREEZE[register-pre-photo-verify-heal-off-trip-keyword]: of·de 잘린 구·식사 키워드 — manifest
 * REGRESSION-FREEZE[register-pre-photo-verify-identity-country-landmark]: 2단어 상호 ≠ 랜드마크 — manifest
 * REGRESSION-FREEZE[register-pre-photo-city-soft-dup-not-bleed]: SSOT 영문은 2단어여도 유지 — manifest
 * REGRESSION-FREEZE[register-schedule-description-no-repeated-closer]: 일차마다 같은 템플릿 closer 금지 — manifest
 * REGRESSION-FREEZE[register-keyword-city-qualified-landmark]: City Mosque·Pink Mosque 단독은 깨진 키워드 — manifest
 */
import {
  isAirlineCarrierImageKeyword,
  isBareCityOrCountryKeyword,
  isGenericAnyCityLandmarkKeyword,
  isHotelLodgingImageKeyword,
  isLikelyTourismLandmarkKeyword,
  isNonLandmarkFoodOrDiningImageKeyword,
  isNonLandmarkSpaShoppingLoungeImageKeyword,
  isWeakOpaqueImageKeyword,
} from '@/lib/pexels-place-name-keyword'
import { tryPersistScheduleImageKeyword } from '@/lib/schedule-image-keyword-persist'
import { getSchedulePoiRegexEnglishKeys } from '@/lib/schedule-poi-regex-ssot'
import { normalizeSemanticPoiKey } from '@/lib/pexels-keyword'

function isScheduleSsotEnglishKeyword(v: string): boolean {
  const nk = normalizeSemanticPoiKey(v)
  if (!nk || nk.length < 6) return false
  const keys = getSchedulePoiRegexEnglishKeys()
  if (keys.has(nk)) return true
  for (const k of keys) {
    if (k.length >= 8 && nk.length >= 8 && (k.startsWith(nk) || nk.startsWith(k))) return true
  }
  return false
}

const FILLER_DESC_RE =
  /하루 동안 여러 장면이 자연스럽게|특정 장소보다 전체적인|명소 나열보다 분위기와 리듬/u
const DUP_GENERIC_CLOSER_RE = /동선에 맞춰(?:\s+하루)?\s+일정을 이어갑니다/gu
/** 중간일 합성 템플릿 closer — 트립에 2일 이상 있으면 같은 소리. */
// REGRESSION-FREEZE[register-schedule-description-no-repeated-closer]: 템플릿 closer — manifest
export const REGISTER_SCHEDULE_TEMPLATE_CLOSER_RE =
  /거리를 걸으며 하루 일정을 이어갑니다|동선에 맞춰(?:\s+하루)?\s+일정을 이어갑니다|섬 일정을 이어서 진행합니다|테마파크 구역을 오가며 하루를 이어갑니다|유적 구간을 천천히 둘러보며 하루를 마무리합니다|전망이 열리는 구간에서 하루를 마무리합니다|항구와 수변 감각으로 하루를 이어갑니다|풍경과 시야가 열리는 구간으로 하루를 이어갑니다|온천 마을 리듬으로 하루를 마무리합니다|휴양 리듬으로 하루를 이어갑니다|초원과 협곡의 스케일로 하루를 이어갑니다|산과 호수 풍경으로 하루를 이어갑니다|중심으로 하루 일정을 진행합니다/u

export type RegisterPrePhotoHealRow = {
  day: number
  title?: string | null
  description?: string | null
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
  imageUrl?: string | null
}

export type BrokenRegisterLandmarkOpts = {
  /** FIT 에어텔은 호텔 키워드를 랜드마크로 허용한다. 패키지는 기본 거부. */
  allowHotelLodging?: boolean
}

export function isBrokenRegisterLandmarkKeyword(
  keyword: string | null | undefined,
  opts?: BrokenRegisterLandmarkOpts,
): boolean {
  const t = String(keyword ?? '').trim()
  if (!t) return false
  // REGRESSION-FREEZE[register-keyword-city-qualified-landmark]: 아무 도시 모스크·시청은 깨짐 — manifest
  if (isGenericAnyCityLandmarkKeyword(t)) return true
  if (!opts?.allowHotelLodging && isHotelLodgingImageKeyword(t)) return true
  if (isNonLandmarkFoodOrDiningImageKeyword(t)) return true
  if (isAirlineCarrierImageKeyword(t)) return true
  if (isNonLandmarkSpaShoppingLoungeImageKeyword(t)) return true
  if (/\s+(?:of|de|du|the|la)$/i.test(t)) return true
  if (/^(?:carbonara|pasta|pizza|gelato|kaiseki|gordon\s*ramsay)\b/i.test(t)) return true
  if (/\bsouvenir(\s*shop)?\b/i.test(t)) return true
  const persist = tryPersistScheduleImageKeyword(t)
  if (!persist.ok) return true
  const v = persist.value
  if (!v) return false
  if (v.length < 3) return true
  if (isWeakOpaqueImageKeyword(v)) return true
  if (opts?.allowHotelLodging && isHotelLodgingImageKeyword(v)) return false
  if (isBareCityOrCountryKeyword(v)) return false
  if (isScheduleSsotEnglishKeyword(v) || isScheduleSsotEnglishKeyword(t)) return false
  if (v.split(/\s+/).filter(Boolean).length >= 2 && !isLikelyTourismLandmarkKeyword(v)) return true
  return false
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

export function tripDaysSharingTemplateCloser(
  rows: readonly Pick<RegisterPrePhotoHealRow, 'day' | 'description'>[],
): Set<number> {
  const days: number[] = []
  for (const row of rows) {
    const t = String(row.description ?? '')
    if (!REGISTER_SCHEDULE_TEMPLATE_CLOSER_RE.test(t)) continue
    const day = Number(row.day)
    if (day > 0) days.push(day)
  }
  if (days.length < 2) return new Set()
  return new Set(days)
}
