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

/** 달력 UI 오염·등급+박일만·출발일 구간 등 — 공급사 공통 1차 거부 */
export function isSupplierListingTitleUnacceptable(text: string, brandKey?: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t || t === '미입력' || t === '상품명 없음') return true
  if (isModetourDepartureWindowOnlyTitleText(t)) return true
  if (isModetourHotelGradeDurationOnlyTitleText(t)) return true
  if (DURATION_ONLY_RE.test(t)) return true
  if (brandKey === 'modetour' && isModetourUnacceptableRegisterListingTitle(t)) return true
  return false
}

export const SUPPLIER_LISTING_TITLE_REJECTED_HINT =
  '붙여넣기 상단의 리스트 제목 줄(#·[지역]·도시명 포함)을 확인하세요. 출발일 구간·박일만 있는 줄은 상품명이 아닙니다.'
