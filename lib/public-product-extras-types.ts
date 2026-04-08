/**
 * 순수 DTO — 쇼핑 행 JSON/표 구조. 공급사별 해석 로직 없음.
 */

export type ShoppingStopRow = {
  itemType: string
  placeName: string
  durationText: string | null
  refundPolicyText: string | null
  raw: string
  city?: string | null
  shopName?: string | null
  shopLocation?: string | null
  itemsText?: string | null
  visitNo?: number | null
  candidateOnly?: boolean
  candidateGroupKey?: string | null
  noteText?: string | null
}
