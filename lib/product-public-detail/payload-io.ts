import { getPublicBookableMinDate, toDepartureDateYmd } from '@/lib/public-bookable-date'
import { isAirHotelDetailVariant } from '@/lib/air-hotel-product-ssot'
import {
  PRODUCT_PUBLIC_DETAIL_PAYLOAD_VERSION,
  type ProductPublicDetailPayloadEnvelope,
  type ProductPublicDetailRenderModel,
} from '@/lib/product-public-detail/types'

export function bookableMinDateYmdForPayload(baseDate: Date = new Date()): string {
  return toDepartureDateYmd(getPublicBookableMinDate(baseDate))
}

export function serializeProductPublicDetailPayload(
  model: ProductPublicDetailRenderModel,
  bookableMinDateYmd: string,
): string {
  const envelope: ProductPublicDetailPayloadEnvelope = {
    version: PRODUCT_PUBLIC_DETAIL_PAYLOAD_VERSION,
    bookableMinDateYmd,
    builtAt: new Date().toISOString(),
    model,
  }
  return JSON.stringify(envelope)
}

export function parseProductPublicDetailPayload(
  raw: string | null | undefined,
  expectedBookableMinDateYmd: string,
): ProductPublicDetailRenderModel | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as ProductPublicDetailPayloadEnvelope
    if (parsed?.version !== PRODUCT_PUBLIC_DETAIL_PAYLOAD_VERSION) return null
    if (parsed.bookableMinDateYmd !== expectedBookableMinDateYmd) return null
    if (!parsed.model || (!isAirHotelDetailVariant(parsed.model.variant) && parsed.model.variant !== 'package')) {
      return null
    }
    return parsed.model
  } catch {
    return null
  }
}
