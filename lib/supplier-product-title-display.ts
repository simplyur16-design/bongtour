/**
 * 방안 B — 공급사 원문 기반 노출 상품명(Product.title) SSOT.
 * REGRESSION-FREEZE[supplier-product-title-plan-b]
 * 마케팅 축약·R-5 LLM 자동 저장 금지 — Product.title 노출명 SSOT.
 *
 * - originalTitle: 붙여넣기·파싱 원문(최소 trim)
 * - display title: UI 노이즈만 제거, #태그·[항공/옵션]·선행 [지역] 배지 유지
 */
import { isModetourUnacceptableRegisterListingTitle } from '@/lib/modetour-departures'

export const SUPPLIER_PRODUCT_TITLE_DISPLAY_POLICY_VERSION = 'plan-b-v1-2026-06-10'

/** Product.title·메타 상한 — bongtour-product-title-tone HARD_MAX 와 동일 */
export const SUPPLIER_PRODUCT_DISPLAY_TITLE_MAX = 90

const UI_NOISE_CHARS = ['★', '※', '◎', '◆', '▶'] as const

export function resolveSupplierVerbatimOriginalTitle(args: {
  parsedSupplierTitle: string
  supplierListingTitleRaw?: string | null
}): string {
  const raw = (args.supplierListingTitleRaw ?? '').trim()
  if (raw.length >= 8) return raw
  const parsed = (args.parsedSupplierTitle ?? '').trim()
  return parsed || '미입력'
}

/** 공백·NBSP·UI 장식(★※▶)만 정리 — #해시·본문 [항공] 블록은 유지 */
export function stripSupplierTitleUiNoise(s: string): string {
  let t = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  t = t.replace(/[\u00a0\u3000]+/g, ' ')
  for (const ch of UI_NOISE_CHARS) {
    t = t.split(ch).join('')
  }
  return t.replace(/\s+/g, ' ').trim()
}

export type SupplierProductDisplayTitleInput = {
  verbatimOriginal: string
  /** modetour 등 부적절 제목 거부 시 폴백 후보 */
  parsedSupplierTitle?: string
  brandKey?: string
}

/**
 * Plan B 노출명 — 원문 기반 경량 정리.
 * 모두투어: `일급호텔 N박M일` 등 부적절 줄은 parsed 후보로 1회 폴백(confirm 게이트는 별도).
 */
export function buildSupplierProductDisplayTitle(input: SupplierProductDisplayTitleInput): string {
  const candidates = [
    stripSupplierTitleUiNoise(input.verbatimOriginal),
    stripSupplierTitleUiNoise(input.parsedSupplierTitle ?? ''),
  ].filter((t) => t.length >= 4)

  for (const c of candidates) {
    const clipped = c.slice(0, SUPPLIER_PRODUCT_DISPLAY_TITLE_MAX)
    if (input.brandKey === 'modetour' && isModetourUnacceptableRegisterListingTitle(clipped)) {
      continue
    }
    return clipped || '미입력'
  }

  const fallback = stripSupplierTitleUiNoise(input.verbatimOriginal).slice(0, SUPPLIER_PRODUCT_DISPLAY_TITLE_MAX)
  return fallback || '미입력'
}
