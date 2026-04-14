/**
 * 한진투어: LLM 경로가 아닌 base HTML + e2e 카드 병합 결과를 등록 미리보기용 JSON으로 정리.
 * 운영 `register-from-llm-ybtour` 등과 파일 분리 유지.
 */
import type { HanjintourDerivedRegisterPayload } from '@/DEV/lib/hanjintour-types'
import { productDepartureToPriceRowsHanjintour } from '@/DEV/lib/product-departure-to-price-rows-hanjintour'

export type HanjintourRegisterBundleJson = {
  supplier: 'hanjintour'
  derived_product_key: string
  display_title: string
  originSource: 'HANJINTOUR'
  originCode: string
  /** 저장 계층 연동 전 단계의 평탄화 객체 */
  flattened: {
    title: string
    schedule_days: number
    price_row_drafts: ReturnType<typeof productDepartureToPriceRowsHanjintour>
    departure_date: string | null
    option_badges: string[]
    status_badges: string[]
  }
}

export function registerFromLlmHanjintourShape(
  derived: HanjintourDerivedRegisterPayload
): HanjintourRegisterBundleJson {
  const rows = productDepartureToPriceRowsHanjintour(derived)
  const c = derived.departure_card
  return {
    supplier: 'hanjintour',
    derived_product_key: derived.derived_product_key,
    display_title: derived.display_title,
    originSource: 'HANJINTOUR',
    originCode: derived.base_common.product_code ?? derived.derived_product_key.slice(0, 24),
    flattened: {
      title: derived.display_title,
      schedule_days: derived.base_common.schedule.length,
      price_row_drafts: rows,
      departure_date: c.selected_departure_date,
      option_badges: c.option_badges,
      status_badges: c.status_badges,
    },
  }
}
