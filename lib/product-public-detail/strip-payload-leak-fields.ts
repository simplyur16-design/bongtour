import type { TravelProduct } from '@/app/components/travel/TravelProductDetail'

/** DB payload 컬럼 — DTO 안에 넣으면 자기참조 누적 */
export const PRODUCT_DETAIL_PAYLOAD_DB_FIELD_NAMES = [
  'publicDetailPayloadJson',
  'publicDetailPayloadBuiltAt',
] as const

export function stripPayloadLeakFieldsFromRecord<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row }
  for (const key of PRODUCT_DETAIL_PAYLOAD_DB_FIELD_NAMES) {
    delete out[key]
  }
  return out
}

/** TravelProduct 직렬화 전 payload 컬럼 제거 */
export function stripPayloadLeakFieldsFromTravelProduct(product: TravelProduct): TravelProduct {
  return stripPayloadLeakFieldsFromRecord(product as TravelProduct & Record<string, unknown>) as TravelProduct
}
