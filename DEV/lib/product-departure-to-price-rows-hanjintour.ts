/**
 * 한진투어 파생 상품 → 출발/가격 행 표현(프로젝트 저장층과 연결 전 단계의 순수 객체).
 * 모달 카드 가격을 SSOT로 둔다.
 */
import type { HanjintourDerivedRegisterPayload } from '@/DEV/lib/hanjintour-types'

export type HanjintourPriceRowDraft = {
  supplier: 'hanjintour'
  derived_product_key: string
  departure_date: string | null
  /** 원 단위 정수 */
  adult_price: number | null
  /** 본문 표에서 온 보조가(검증·표시) */
  body_adult_reference: number | null
  currency: 'KRW'
  status_badges: string[]
  option_badges: string[]
  raw_card_excerpt: string
}

export function productDepartureToPriceRowsHanjintour(
  derived: HanjintourDerivedRegisterPayload
): HanjintourPriceRowDraft[] {
  const c = derived.departure_card
  return [
    {
      supplier: 'hanjintour',
      derived_product_key: derived.derived_product_key,
      departure_date: c.selected_departure_date,
      adult_price: derived.sale_price_ssot,
      body_adult_reference: derived.body_price_reference.adult,
      currency: 'KRW',
      status_badges: c.status_badges,
      option_badges: c.option_badges,
      raw_card_excerpt: c.raw_card_text.slice(0, 500),
    },
  ]
}
