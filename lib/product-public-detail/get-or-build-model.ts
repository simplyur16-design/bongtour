/**
 * REGRESSION-FREEZE[product-detail-payload-slim-persist]: slim 행 live build·persist 금지 — manifest
 */
import {
  buildProductDetailPageSelect,
  isProductDetailSlimRow,
  type ProductDetailPageLoadRow,
} from '@/lib/product-detail-page-include'
import { productDetailPayloadByteLength } from '@/lib/product-detail-payload-hit'
import {
  buildProductPublicDetailRenderModel,
  type FitMasterWithDays,
  type ProductDetailViewRow,
} from '@/lib/product-public-detail/build-render-model'
import { bookableMinDateYmdForPayload, parseProductPublicDetailPayload } from '@/lib/product-public-detail/payload-io'
import { finalizeProductPublicDetailPayloadJson } from '@/lib/product-public-detail/build-product-public-detail-payload'
import { isProductDetailPerfLogEnabled, patchProductDetailPerf } from '@/lib/product-detail-perf'
import { after } from 'next/server'
import { isNextRouterPrefetchRequest } from '@/lib/next-router-prefetch'
import { prisma } from '@/lib/prisma'
import { logQ5Trigger } from '@/lib/q5-trigger-log'

export type ProductDetailBuildSource = 'payload' | 'computed'

export type ProductDetailModelResult = {
  model: Awaited<ReturnType<typeof buildProductPublicDetailRenderModel>>
  source: ProductDetailBuildSource
}

/** slim select 행 — title·schedule·rawMeta 없음. live build·persist SSOT는 full row만. */
async function loadFullProductDetailRowForBuild(productId: string): Promise<ProductDetailViewRow | null> {
  logQ5Trigger('get-or-build', productId, 'slim-parse-miss')
  return prisma.product.findFirst({
    where: {
      id: productId,
      registrationStatus: 'registered',
    },
    select: buildProductDetailPageSelect(new Date()),
  }) as Promise<ProductDetailViewRow | null>
}

async function resolveProductDetailRowForLiveBuild(
  travelProduct: ProductDetailPageLoadRow,
): Promise<{ row: ProductDetailViewRow; canPersistPayload: boolean }> {
  if (!isProductDetailSlimRow(travelProduct)) {
    return { row: travelProduct as ProductDetailViewRow, canPersistPayload: true }
  }
  const full = await loadFullProductDetailRowForBuild(travelProduct.id)
  if (full) {
    return { row: full, canPersistPayload: true }
  }
  // full load 실패 시 degraded build — persist는 canPersistPayload=false 로 차단
  return { row: travelProduct as unknown as ProductDetailViewRow, canPersistPayload: false }
}

/** 캐시된 DTO가 있으면 파싱 생략, 없으면 계산 후 registered 상품은 DB에 저장 */
export async function getOrBuildProductPublicDetailModel(
  travelProduct: ProductDetailPageLoadRow & {
    publicDetailPayloadJson?: string | null
  },
  fitMaster: FitMasterWithDays | null,
): Promise<ProductDetailModelResult> {
  const json = travelProduct.publicDetailPayloadJson ?? null
  if (isProductDetailPerfLogEnabled()) {
    patchProductDetailPerf({ payloadBytes: productDetailPayloadByteLength(json) })
  }

  const bookableYmd = bookableMinDateYmdForPayload()
  const parseStart = isProductDetailPerfLogEnabled() ? Date.now() : 0
  const cached = parseProductPublicDetailPayload(json, bookableYmd)
  if (isProductDetailPerfLogEnabled()) {
    patchProductDetailPerf({ parseMs: Date.now() - parseStart })
  }
  if (cached) {
    if (isProductDetailPerfLogEnabled()) {
      patchProductDetailPerf({ payloadSource: 'payload' })
    }
    return { model: cached, source: 'payload' }
  }

  const { row: buildRow, canPersistPayload } = await resolveProductDetailRowForLiveBuild(travelProduct)
  const model = await buildProductPublicDetailRenderModel(buildRow, fitMaster)
  if (isProductDetailPerfLogEnabled()) {
    patchProductDetailPerf({ payloadSource: 'computed' })
  }

  if (
    canPersistPayload &&
    travelProduct.registrationStatus === 'registered' &&
    !(await isNextRouterPrefetchRequest())
  ) {
    const json = finalizeProductPublicDetailPayloadJson(model, bookableYmd)
    if (!json) {
      return { model, source: 'computed' }
    }
    const productId = travelProduct.id
    /** RSC render 중 revalidateTag 금지(Next 15) — payload는 DB에만 저장, 태그 무효화는 admin·야간 cron */
    after(async () => {
      try {
        await prisma.product.update({
          where: { id: productId },
          data: {
            publicDetailPayloadJson: json,
            publicDetailPayloadBuiltAt: new Date(),
          },
        })
      } catch (err) {
        console.error('[product-public-detail] persist payload failed', productId, err)
      }
    })
  }

  return { model, source: 'computed' }
}
