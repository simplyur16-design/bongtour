import { getPublicBookableMinDate, toDepartureDateYmd } from '@/lib/public-bookable-date'
import { isAirHotelDetailVariant } from '@/lib/air-hotel-product-ssot'
import { isEmptyShellPayloadView } from '@/lib/product-public-detail/payload-corrupt-guard'
import {
  PRODUCT_PUBLIC_DETAIL_PAYLOAD_VERSION,
  type ProductPublicDetailPayloadEnvelope,
  type ProductPublicDetailRenderModel,
} from '@/lib/product-public-detail/types'

/** 캐시된 공개 DTO에 남아 있는 일정 동선 지도 필드는 응답에 실지 않는다. */
export function omitItineraryRouteMapFromPublicModel(model: ProductPublicDetailRenderModel): void {
  const walk = (value: unknown, depth: number) => {
    if (!value || typeof value !== 'object' || depth > 6) return
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1)
      return
    }
    const obj = value as Record<string, unknown>
    delete obj.itineraryRouteMap
    delete obj.itineraryRouteMapUrl
    for (const child of Object.values(obj)) walk(child, depth + 1)
  }
  walk(model, 0)
}

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
    const payloadBytes = Buffer.byteLength(raw, 'utf8')
    if (isEmptyShellPayloadView(parsed.model.viewProduct, payloadBytes)) {
      return null
    }
    omitItineraryRouteMapFromPublicModel(parsed.model)
    return parsed.model
  } catch {
    return null
  }
}
