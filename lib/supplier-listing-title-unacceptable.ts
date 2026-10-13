/**
 * 6공급사 등록 — 리스트 상품명으로 부적절한 줄(출발일 구간·박일만 등).
 * REGRESSION-FREEZE[supplier-product-title-plan-b]
 */
import {
  isModetourDepartureWindowOnlyTitleText,
  isModetourHotelGradeDurationOnlyTitleText,
  isModetourUnacceptableRegisterListingTitle,
} from '@/lib/modetour-departures'

const DURATION_ONLY_RE = /^\d+\s*박\s*\d+\s*일\s*$/u

/** 교원이지 tourCode 단독 줄 — 상품명 아님 */
export const KYOWONTOUR_TOUR_CODE_TITLE_RE = /^[A-Z]{2,4}\d{6,}[A-Z0-9]*$/i

/** 일정 일차 title·호텔 줄이 상품명으로 누수된 경우 */
// REGRESSION-FREEZE[register-pre-photo-product-title-day-leak]: 일차|·호텔 줄 ≠ listing title — manifest
const SCHEDULE_DAY_TITLE_AS_PRODUCT_RE =
  /^\d+\s*일차\s*[|｜]/u
const SCHEDULE_HOTEL_MEAL_LEAK_IN_TITLE_RE = /[|｜]\s*(?:호텔|식사)\s*[:：]/u

/** 달력 UI 오염·등급+박일만·출발일 구간 등 — 공급사 공통 1차 거부 */
// REGRESSION-FREEZE[supplier-product-title-plan-b]: stub 미지정 거부 — manifest
// REGRESSION-FREEZE[ybtour-register-listing-title-fallback]: stub 미지정 거부 — manifest
export function isSupplierListingTitleUnacceptable(text: string, brandKey?: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t || t === '미입력' || t === '상품명 없음' || t === '미지정') return true
  if (KYOWONTOUR_TOUR_CODE_TITLE_RE.test(t)) return true
  // REGRESSION-FREEZE[register-pre-photo-product-title-day-leak]: day-title·호텔 누수 거부 — manifest
  if (SCHEDULE_DAY_TITLE_AS_PRODUCT_RE.test(t) || SCHEDULE_HOTEL_MEAL_LEAK_IN_TITLE_RE.test(t)) {
    return true
  }
  if (/^여행은\s*모두투어$|^모두투어$/u.test(t)) return true
  if (isModetourDepartureWindowOnlyTitleText(t)) return true
  if (isModetourHotelGradeDurationOnlyTitleText(t)) return true
  if (DURATION_ONLY_RE.test(t)) return true
  if (brandKey === 'modetour' && isModetourUnacceptableRegisterListingTitle(t)) return true
  return false
}

export const SUPPLIER_LISTING_TITLE_REJECTED_HINT =
  '붙여넣기 상단의 리스트 제목 줄(#·[지역]·도시명 포함)을 확인하세요. 출발일 구간·박일만 있는 줄은 상품명이 아닙니다.'
