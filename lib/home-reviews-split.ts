/**
 * 메인 홈 — 패키지 vs 모임여행 후기 분류 (customer_type 우선, display_order 보조).
 */

/** 모임여행 후기 carousel 자동 전환(ms) */
export const HOME_REVIEW_CAROUSEL_INTERVAL_MS = 6000

const GROUP_CUSTOMER_TYPE_RE =
  /모임|산악회|시니어|최고경영|협회|동문|원우|단체|기업|워크숍|소규모|우리여행|친목|사업자|상인회|경영자|동호회|산행|친목여행/i

const PACKAGE_CUSTOMER_TYPE_RE =
  /가족|부부|혼자|친구|부모|가족여행|부부여행|혼자여행|친구여행|부모님동반|자유여행|커플/i

export function isHomeGroupMeetingCustomerType(customerType: string | null): boolean {
  if (!customerType?.trim()) return false
  return GROUP_CUSTOMER_TYPE_RE.test(customerType.trim())
}

export function isHomePackageCustomerType(customerType: string | null): boolean {
  if (!customerType?.trim()) return false
  return PACKAGE_CUSTOMER_TYPE_RE.test(customerType.trim())
}

/** 패키지(51~150) · 모임(1~50) display_order 구간 — DB 시드·운영 기준 */
export function classifyHomeReview(row: {
  customer_type: string | null
  display_order: number
}): 'package' | 'group' | null {
  if (isHomeGroupMeetingCustomerType(row.customer_type)) return 'group'
  if (isHomePackageCustomerType(row.customer_type)) return 'package'
  const order = row.display_order
  if (order >= 51 && order <= 150) return 'package'
  if (order >= 1 && order <= 50) return 'group'
  return null
}
