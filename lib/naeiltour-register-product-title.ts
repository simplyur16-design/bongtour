/**
 * 내일투어(naeiltour) 등록 상품명 — 노출용 정리.
 * REGRESSION-FREEZE[naeiltour-register-product-title]: 금까기·진짜 제거 — manifest
 */
import { stripSupplierTitleUiNoise } from '@/lib/supplier-product-title-display'

/** 등록·저장 노출명 — 「금까기」「진짜」 브랜드 접미/수식어 제거 (원문 rawTitle은 별도 보존) */
export function normalizeNaeiltourRegisterListingTitle(s: string | null | undefined): string {
  let t = stripSupplierTitleUiNoise(String(s ?? ''))
  t = t.replace(/금까기/g, '').replace(/진짜/g, '')
  return t.replace(/\s+/g, ' ').trim()
}
