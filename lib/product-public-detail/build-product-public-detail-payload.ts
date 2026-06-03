import type { FitMasterWithDays, ProductDetailViewRow } from '@/lib/product-public-detail/build-render-model'
import { buildProductPublicDetailRenderModel } from '@/lib/product-public-detail/build-render-model'
import {
  bookableMinDateYmdForPayload,
  serializeProductPublicDetailPayload,
} from '@/lib/product-public-detail/payload-io'
import { prepareModelForPayloadPersistence } from '@/lib/product-public-detail/prepare-model-for-payload'
import type { ProductPublicDetailRenderModel } from '@/lib/product-public-detail/types'

/** runtime assertion — 회귀 시 persist 중단 */
export const PRODUCT_PUBLIC_DETAIL_PAYLOAD_MAX_BYTES = 1_000_000

const SELF_REFERENCE_FORBIDDEN = /publicDetailPayloadJson/i

export function assertProductPublicDetailPayloadJson(json: string): void {
  if (SELF_REFERENCE_FORBIDDEN.test(json)) {
    throw new Error('[product-public-detail-payload] self-reference: publicDetailPayloadJson in output')
  }
  if (json.length > PRODUCT_PUBLIC_DETAIL_PAYLOAD_MAX_BYTES) {
    throw new Error(
      `[product-public-detail-payload] size ${json.length} exceeds ${PRODUCT_PUBLIC_DETAIL_PAYLOAD_MAX_BYTES} bytes`,
    )
  }
}

/**
 * DTO JSON 생성 SSOT — cron·sync·admin·backfill·postdeploy 모두 이 함수만 사용.
 * 실패 시 null (DB 컬럼 NULL 유지 → 상세는 live build fallback).
 */
export function finalizeProductPublicDetailPayloadJson(
  model: ProductPublicDetailRenderModel,
  bookableMinDateYmd: string = bookableMinDateYmdForPayload(),
): string | null {
  try {
    const prepared = prepareModelForPayloadPersistence(model)
    const json = serializeProductPublicDetailPayload(prepared, bookableMinDateYmd)
    assertProductPublicDetailPayloadJson(json)
    return json
  } catch (e) {
    console.error('[buildProductPublicDetailPayload] finalize failed', e)
    return null
  }
}

export async function buildProductPublicDetailPayload(
  travelProduct: ProductDetailViewRow,
  fitMaster: FitMasterWithDays | null,
): Promise<string | null> {
  const model = await buildProductPublicDetailRenderModel(travelProduct, fitMaster)
  return finalizeProductPublicDetailPayloadJson(model)
}
