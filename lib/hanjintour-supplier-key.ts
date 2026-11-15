/**
 * 한진관광 공급사 키. 기존 7곳 canonical 목록(야간 수집·붙여넣기 등록)에는 넣지 않는다.
 * 관리자 상품 목록 필터와 등록대기 upsert 만 이 키를 쓴다.
 * REGRESSION-FREEZE[hanjintour-register-pending-only]: 공급사 키·관리자 필터 — manifest
 */

export const HANJINTOUR_SUPPLIER_KEY = 'hanjintour' as const

/** 관리자 상품 목록 공급사 필터. 기존 7곳 + hanjintour. */
export const ADMIN_PRODUCT_ORIGIN_FILTERS = [
  'hanatour',
  'modetour',
  'ybtour',
  'naeiltour',
  'lottetour',
  'verygoodtour',
  'kyowontour',
  'hanjintour',
] as const

export type AdminProductOriginFilter = (typeof ADMIN_PRODUCT_ORIGIN_FILTERS)[number]

export function isAdminProductOriginFilter(value: string): value is AdminProductOriginFilter {
  return (ADMIN_PRODUCT_ORIGIN_FILTERS as readonly string[]).includes(value)
}
