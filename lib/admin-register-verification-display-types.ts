/**
 * 등록 검증 패널 `display.shopping.rows` 공통 형태.
 * 하나투어 5열 TSV 등으로 채워지는 확장 필드는 optional — 다른 브랜드는 미제공 시 생략.
 */
export type RegisterVerificationShoppingRowDisplay = {
  shoppingItem: string
  shoppingPlace: string
  durationText: string
  refundPolicyText: string
  city?: string | null
  shopName?: string | null
  shopLocation?: string | null
  itemsText?: string | null
  noteText?: string | null
}
