/**
 * 등록 목적지·관리자 목록 지역 컬럼 — UI 섹션·탭 라벨 금지 (전 공급사 공통).
 * REGRESSION-FREEZE[lottetour-register-destination]: manifest
 */
import { isSupplierTitlePromoBadgeText } from '@/lib/supplier-product-title-display'
import { isRegisterDestinationTourStyleNoiseToken } from '@/lib/register-destination-tour-style-noise'

const UI_LABEL_RE =
  /^(?:여행\s*일정(?:표)?|상품\s*안내|상품안내|상품\s*개요|상품개요|여행\s*주요\s*일정|여행\s*핵심\s*정보|일정표|상세\s*일정|간략\s*일정|포함\s*사항|불포함\s*사항|항공\s*여정|예약\s*현황|상품\s*가격|출발\s*일정|미지정)$/i

/** 붙여넣기·파서가 목적지로 쓰면 안 되는 UI 라벨 */
export function isSupplierRegisterDestinationUiLabel(s: string): boolean {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t || t.length < 2) return true
  if (UI_LABEL_RE.test(t)) return true
  if (isSupplierTitlePromoBadgeText(t)) return true
  // REGRESSION-FREEZE[register-destination-reject-ilju]: tour-style noise = UI pollution — manifest
  if (isRegisterDestinationTourStyleNoiseToken(t)) return true
  return false
}

/** 후보 문자열 — UI 라벨·마케팅 뱃지·일주 노이즈 제외 */
export function acceptSupplierRegisterDestinationCandidate(s: string | null | undefined): string | null {
  const t = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t || isSupplierRegisterDestinationUiLabel(t)) return null
  return t
}
