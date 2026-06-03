import { bookableMinDateYmdForPayload, parseProductPublicDetailPayload } from '@/lib/product-public-detail/payload-io'

/** DB slim select 가능 여부 — bookableMinDateYmd·version 정합 (payload-io SSOT, 변경 없음) */
export function productDetailPayloadDtoHit(
  publicDetailPayloadJson: string | null | undefined,
  baseDate: Date = new Date(),
): boolean {
  if (!publicDetailPayloadJson?.trim()) return false
  const bookableYmd = bookableMinDateYmdForPayload(baseDate)
  return parseProductPublicDetailPayload(publicDetailPayloadJson, bookableYmd) != null
}

export function productDetailPayloadByteLength(
  publicDetailPayloadJson: string | null | undefined,
): number {
  if (!publicDetailPayloadJson) return 0
  return Buffer.byteLength(publicDetailPayloadJson, 'utf8')
}
