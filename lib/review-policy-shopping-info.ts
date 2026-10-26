/**
 * Admin review-policy shopping info line — unknown vs explicit 노쇼핑.
 * REGRESSION-FREEZE[review-policy-shopping-unknown]: 빈 rows ≠ 쇼핑 없음 — manifest
 */
import type { ShoppingStructured } from '@/lib/detail-body-parser-types'

const EXPLICIT_NO_SHOPPING_RE = /노\s*쇼핑|쇼핑\s*없(?:음|이)|쇼핑\s*0\s*회|0\s*회\s*쇼핑|shopping\s*none/i

export function isExplicitNoShoppingSignal(shopping: ShoppingStructured): boolean {
  if (EXPLICIT_NO_SHOPPING_RE.test(String(shopping.shoppingCountText ?? ''))) return true
  return shopping.reviewReasons.some((r) => EXPLICIT_NO_SHOPPING_RE.test(String(r)))
}

/** rows 없을 때 info 문구 — 명시 신호만 '쇼핑 없음' */
export function reviewPolicyShoppingEmptyInfoLine(shopping: ShoppingStructured): string {
  if (shopping.rows.length > 0) return ''
  return isExplicitNoShoppingSignal(shopping)
    ? '쇼핑 없음'
    : '쇼핑 정보 없음(미확인)'
}
