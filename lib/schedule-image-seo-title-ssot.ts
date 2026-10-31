/**
 * 일정 사진 SEO 제목(imageSeoTitleKr) — 한글 짧은 명소·도시명만.
 * Pexels 영문 키워드·사진풀 city·DAY·공항·날짜 오염 금지.
 * REGRESSION-FREEZE[schedule-image-seo-title-ssot]: 3문장 vibe·DAYN·허브공항 금지 — manifest
 * REGRESSION-FREEZE[product-image-seo-review-contamination]: 리뷰·여행후기 제목 금지 — manifest
 * REGRESSION-FREEZE[product-image-seo-coreinfo-airline-contamination]: 여행핵심정보·항공사명 제목 금지 — manifest
 */
import { splitRouteTextPlaceSegments } from '@/lib/register-schedule-llm-image-keyword-fallback'
import {
  filterRegisterScheduleRoutePlaceSegments,
  isRegisterScheduleDomesticHubRouteSegment,
} from '@/lib/register-schedule-route-place-noise'
import { isProductImageOpsSeoContaminated } from '@/lib/product-hero-listing-seo-contamination'

export const SCHEDULE_IMAGE_SEO_TITLE_MAX = 48

const DAY_N_RE = /(?:^|[·,\s/])DAY\s*\d+(?:$|[·,\s/])/i
const DATE_RE = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/
const MOVE_RE = /출발\s*이동|도착\s*이동|인천\s*이동|귀국\s*이동/
const SUPPLIER_RE = /하나투어|모두투어|참좋은|노랑풍선|롯데관광|교원이지|very\s*good/i
const VIBE_RE = /하루 동안 여러 장면|특정 장소보다 전체적인|입니다\.\s*.{8,}입니다\./
const STORAGE_RE = /schedules\/|unknown-|premade|pexels|photo-\d|%[0-9A-Fa-f]{2}|https?:\/\//i

/** 공개 SEO 제목으로 쓰기 부적합 */
export function isPollutedScheduleImageSeoTitle(value: string | null | undefined): boolean {
  const t = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return true
  if (t.length > 72) return true
  if (DAY_N_RE.test(t)) return true
  if (DATE_RE.test(t)) return true
  if (MOVE_RE.test(t)) return true
  if (SUPPLIER_RE.test(t)) return true
  if (VIBE_RE.test(t)) return true
  if (STORAGE_RE.test(t)) return true
  if (isRegisterScheduleDomesticHubRouteSegment(t)) return true
  if (/^(?:Incheon|Gimpo|Busan|Daegu|Seoul|Jeju|ICN|GMP|PUS|TAE|CJJ|CJU)$/i.test(t)) return true
  if (isProductImageOpsSeoContaminated(t)) return true
  if (!/[가-힣]{2,}/.test(t)) return true
  return false
}

function stripPlaceParens(label: string): string {
  return label
    .replace(/\s*\([^)]*\)\s*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickKoreanRoutePlace(routeText: string | null | undefined): string | null {
  const segs = filterRegisterScheduleRoutePlaceSegments(splitRouteTextPlaceSegments(String(routeText ?? '')))
  const ko = segs
    .map((s) => stripPlaceParens(s))
    .filter((s) => s.length >= 2 && /[가-힣]{2,}/.test(s) && !isPollutedScheduleImageSeoTitle(s))
  if (ko.length === 0) return null
  const specific = ko.find((s) => s.length >= 3)
  const picked = specific || ko[0]!
  // day-label-keep-selection-1031: 선택(인덱스)은 기존 그대로, 표시만 잘린 「로」 끝 지명을 원래 이름으로 복원
  return restoreRoEndingPlaceName(picked, routeText).slice(0, SCHEDULE_IMAGE_SEO_TITLE_MAX)
}

/** 끝 「로」가 지명 일부인 이름 (조사 아님) — day-label-keep-selection-1031 */
const RO_ENDING_PLACE_NAME_RE =
  /^(?:카이로|올드\s*카이로|오슬로|몬테네그로|구시로|리우\s*데\s*자네이로|자네이로|비스트로|레트로|모지코\s*레트로|해변\s*도로|도로)$/u

/**
 * route 장소 정리 단계에서 조사로 오인해 잘린 이름(`카이로`→`카이`)을 표시용으로만 되돌린다.
 * `picked + 로` 가 allowlist 지명이고 원래 routeText 에 그 이름이 실제로 있을 때만. 그 외는 picked 그대로.
 */
export function restoreRoEndingPlaceName(picked: string, routeText: string | null | undefined): string {
  const full = `${picked}로`
  if (!RO_ENDING_PLACE_NAME_RE.test(full.replace(/\s+/g, ' ').trim())) return picked
  const key = (v: string) => v.replace(/\s+/g, '')
  if (!key(String(routeText ?? '')).includes(key(full))) return picked
  return full
}

/**
 * 일차 사진 SEO 제목 — routeText 명소 우선, 귀국일은 「귀국」.
 * REGRESSION-FREEZE[schedule-image-seo-title-ssot]
 */
export function composeScheduleImageSeoTitleKr(opts: {
  day: number
  maxDay?: number
  routeText?: string | null
  destination?: string | null
  productTitle?: string | null
}): string | null {
  const day = Math.max(1, Math.floor(Number(opts.day) || 1))
  const maxDay = Math.max(day, Math.floor(Number(opts.maxDay) || day))
  const fromRoute = pickKoreanRoutePlace(opts.routeText)
  if (fromRoute) return fromRoute
  if (maxDay >= 2 && day === maxDay) return '귀국'
  const dest = String(opts.destination ?? '')
    .split(/[,/·|]/)[0]
    ?.replace(/\s+/g, ' ')
    .trim()
  if (dest && /[가-힣]{2,}/.test(dest) && !isPollutedScheduleImageSeoTitle(dest) && !DAY_N_RE.test(dest)) {
    const label = `${dest} 여행`.slice(0, SCHEDULE_IMAGE_SEO_TITLE_MAX)
    if (!isPollutedScheduleImageSeoTitle(label)) return label
  }
  return null
}

export function resolveScheduleImageSeoTitleKr(opts: {
  stored?: string | null
  day: number
  maxDay?: number
  routeText?: string | null
  destination?: string | null
  productTitle?: string | null
}): string | null {
  const stored = String(opts.stored ?? '').trim()
  if (stored && !isPollutedScheduleImageSeoTitle(stored)) {
    return stored.slice(0, SCHEDULE_IMAGE_SEO_TITLE_MAX)
  }
  return composeScheduleImageSeoTitleKr(opts)
}
